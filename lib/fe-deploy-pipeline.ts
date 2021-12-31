import {
  aws_codepipeline_actions as codepipeline_actions,
  aws_codepipeline as codepipeline,
  aws_codebuild as codebuild,
  aws_ecs as ecs,
  aws_ecr as ecr,
  SecretValue,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface GitHubRepository {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

interface FeDeploymentPipelineStackProps extends StackProps {
  feRepository: GitHubRepository;
}

export class FeDeploymentPipelineStack extends Stack {
  public readonly tagParameterContainerImage: ecs.TagParameterContainerImage;

  constructor(
    scope: Construct,
    id: string,
    props: FeDeploymentPipelineStackProps
  ) {
    super(scope, id, props);
    const { feRepository } = props;

    const feSourceOutput = new codepipeline.Artifact();
    const feBuildOutput = new codepipeline.Artifact();

    // Source Actions
    // Get fe source
    const feSourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: "Frontend_Source",
      owner: feRepository.owner,
      repo: feRepository.repo,
      oauthToken: SecretValue.secretsManager(feRepository.token),
      output: feSourceOutput,
      branch: feRepository.branch, // default: 'master',
    });

    // Create fe project
    const feProject = new codebuild.PipelineProject(
      this,
      "FrontendAppProject",
      {
        environment: {
          privileged: true,
        },
        buildSpec: codebuild.BuildSpec.fromObject({
          version: "0.2",
          phases: {
            build: {
              commands: ["npm ci", "npm start"],
            },
          },
          artifacts: {
            // store the entire Cloud Assembly as the output artifact
            "base-directory": "build",
            files: "**/*",
          },
        }),
      }
    );

    //Build Actions
    const feBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "CodeBuild",
      project: feProject,
      input: feSourceOutput,
      outputs: [feBuildOutput],
    });

    new codepipeline.Pipeline(this, "FrontendDeployment", {
      pipelineName: "FrontendDeployment",
      crossAccountKeys: false,
      stages: [
        {
          stageName: "Source",
          actions: [feSourceAction],
        },
        {
          stageName: "Build",
          actions: [feBuildAction],
        },
      ],
    });
  }
}
