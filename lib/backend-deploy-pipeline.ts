import {
  aws_codepipeline_actions as codepipeline_actions,
  aws_codepipeline as codepipeline,
  aws_codebuild as codebuild,
  aws_ecs as ecs,
  aws_ecr as ecr,
  SecretValue,
  Stack,
  StackProps,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface GitHubRepository {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

interface MyPipelineStackProps extends StackProps {
  backendRepository: GitHubRepository;
  cdkRepository: GitHubRepository;
}

export class MyPipelineStack extends Stack {
  public readonly tagParameterContainerImage: ecs.TagParameterContainerImage;

  constructor(scope: Construct, id: string, props: MyPipelineStackProps) {
    super(scope, id, props);
    const { backendRepository, cdkRepository } = props;

    const backendSourceOutput = new codepipeline.Artifact();
    const cdkSourceOutput = new codepipeline.Artifact();
    const cdkCodeBuildOutput = new codepipeline.Artifact();

    // Source Actions
    // Get backend source
    const backendSourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: "Backend_Source",
      owner: backendRepository.owner,
      repo: backendRepository.repo,
      oauthToken: SecretValue.secretsManager(backendRepository.token),
      output: backendSourceOutput,
      branch: backendRepository.branch, // default: 'master',
    });
    backendSourceAction.actionProperties.resource?.applyRemovalPolicy(
      RemovalPolicy.DESTROY
    );
    // Get CDK source
    const cdkSourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: "CDK_Source",
      owner: cdkRepository.owner,
      repo: cdkRepository.repo,
      oauthToken: SecretValue.secretsManager(cdkRepository.token),
      output: cdkSourceOutput,
      branch: cdkRepository.branch, // default: 'master'
    });
    cdkSourceAction.actionProperties.resource?.applyRemovalPolicy(
      RemovalPolicy.DESTROY
    );

    // this is the ECR repository where the built Docker image will be pushed
    const appEcrRepo = new ecr.Repository(this, "TestBackendAppRepository");

    // Create codebuild project
    const backendProject = new codebuild.PipelineProject(
      this,
      "TestBackendAppProject",
      {
        environment: {
          privileged: true,
        },
        buildSpec: codebuild.BuildSpec.fromObject({
          version: "0.2",
          phases: {
            build: {
              commands: [
                // login to ECR first
                "$(aws ecr get-login --region $AWS_DEFAULT_REGION --no-include-email)",

                // build the image, and tag it with the commit hash
                // (CODEBUILD_RESOLVED_SOURCE_VERSION is a special environment variable available in CodeBuild)
                "docker build -t $REPOSITORY_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION .",
              ],
            },
            post_build: {
              commands: [
                // push the built image into the ECR repository
                "docker push $REPOSITORY_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION",

                // save the declared tag as an environment variable,
                // that is then exported below in the 'exported-variables' section as a CodePipeline Variable
                "export imageTag=$CODEBUILD_RESOLVED_SOURCE_VERSION",
              ],
            },
          },
          env: {
            // save the imageTag environment variable as a CodePipeline Variable
            "exported-variables": ["imageTag"],
          },
        }),
        environmentVariables: {
          REPOSITORY_URI: {
            value: appEcrRepo.repositoryUri,
          },
        },
      }
    );

    // Permissions needed for `docker push`
    appEcrRepo.grantPullPush(backendProject);

    // create the ContainerImage used for the ECS application Stack
    this.tagParameterContainerImage = new ecs.TagParameterContainerImage(
      appEcrRepo
    );

    const cdkProject = new codebuild.PipelineProject(this, "CdkProject", {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: ["npm install"],
          },
          build: {
            commands: [
              // synthesize the CDK code for the ECS application Stack
              "npx cdk synth --verbose",
            ],
          },
        },
        artifacts: {
          // store the entire Cloud Assembly as the output artifact
          "base-directory": "cdk.out",
          files: "**/*",
        },
      }),
    });

    //Build Actions
    const backendBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "CodeBuild",
      project: backendProject,
      input: backendSourceOutput,
    });
    backendBuildAction.actionProperties.resource?.applyRemovalPolicy(
      RemovalPolicy.DESTROY
    );

    const cdkBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "CdkBuild",
      project: cdkProject,
      input: cdkSourceOutput,
      outputs: [cdkCodeBuildOutput],
    });
    cdkBuildAction.actionProperties.resource?.applyRemovalPolicy(
      RemovalPolicy.DESTROY
    );

    // Deploy Action
    const deployAction =
      new codepipeline_actions.CloudFormationCreateUpdateStackAction({
        actionName: "Deploy",
        stackName: "FargateDeploymentStack",
        // this name has to be the same name as used below in the CDK code for the application Stack
        templatePath: cdkCodeBuildOutput.atPath(
          "FargateDeploymentStack.template.json"
        ),
        adminPermissions: true,
        parameterOverrides: {
          // read the tag pushed to the ECR repository from the CodePipeline Variable saved by the application build step,
          // and pass it as the CloudFormation Parameter for the tag
          [this.tagParameterContainerImage.tagParameterName]:
            backendBuildAction.variable("imageTag"),
        },
      });

    new codepipeline.Pipeline(this, "BackendDeployment", {
      pipelineName: "BackendDeployment",
      crossAccountKeys: false,
      stages: [
        {
          stageName: "Source",
          actions: [backendSourceAction, cdkSourceAction],
        },
        {
          stageName: "Build",
          actions: [backendBuildAction, cdkBuildAction],
        },
        {
          stageName: "Deploy",
          actions: [deployAction],
        },
      ],
    });
  }
}
