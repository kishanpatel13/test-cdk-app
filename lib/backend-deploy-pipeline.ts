import * as cdk from "aws-cdk-lib";
import {
  aws_codepipeline_actions as codepipeline_actions,
  aws_codepipeline as codepipeline,
  aws_codebuild as codebuild,
  aws_ecs as ecs,
  aws_ecr as ecr,
  SecretValue,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class MyPipelineStack extends cdk.Stack {
  public readonly tagParameterContainerImage: ecs.TagParameterContainerImage;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const backendSourceOutput = new codepipeline.Artifact();
    const cdkSourceOutput = new codepipeline.Artifact();
    const cdkCodeBuildOutput = new codepipeline.Artifact();

    // Source Actions
    // Get backend source
    const backendSourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: "GitHub_Source",
      owner: "kishanpatel13",
      repo: "test-be-app",
      oauthToken: new SecretValue("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"),
      output: backendSourceOutput,
      branch: "main", // default: 'master'
    });
    // Get CDK source
    const cdkSourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: "GitHub_Source",
      owner: "kishanpatel13",
      repo: "test-cdk-app",
      oauthToken: new SecretValue("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"),
      output: cdkSourceOutput,
      branch: "main", // default: 'master'
    });

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
          phases: {
            version: "0.2",
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

    const cdkBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "CdkBuild",
      project: cdkProject,
      input: cdkSourceOutput,
      outputs: [cdkCodeBuildOutput],
    });

    // Deploy Action
    const deployAction =
      new codepipeline_actions.CloudFormationCreateUpdateStackAction({
        actionName: "Deploy",
        stackName: "BackendDeploymentFromCodePipeline",
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
