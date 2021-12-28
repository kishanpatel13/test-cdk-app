import {
  aws_amplify as amplify,
  aws_codebuild,
  App,
  Stack,
  StackProps,
  SecretValue,
} from "aws-cdk-lib";
import * as amplify_build_spec from "./amplify_build_spec.json";

interface AddAmplifyStackProps extends StackProps {
  repositoryUrl: string;
  branch: string;
  token: string;
}

export class AddAmplifyStack extends Stack {
  constructor(scope: App, id: string, props: AddAmplifyStackProps) {
    super(scope, id, props);

    const amplifyBuildSpec =
      aws_codebuild.BuildSpec.fromObject(amplify_build_spec);

    const amplifyApp = new amplify.CfnApp(this, "AmplifyApp", {
      name: "AmplifyApp",
      repository: props.repositoryUrl,
      oauthToken: SecretValue.secretsManager(props.token).toString(),
      buildSpec: amplifyBuildSpec.toBuildSpec(),
    });

    new amplify.CfnBranch(this, "mainBranch", {
      branchName: props.branch,
      appId: amplifyApp.attrAppId,
    });
  }
}
