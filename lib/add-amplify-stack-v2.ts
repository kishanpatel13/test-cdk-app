import {
  aws_amplify as amplify,
  aws_codebuild,
  App,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import * as amplify_build_spec from "./amplify_build_spec.json";

export class AddAmplifyStack2 extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const amplifyBuildSpec =
      aws_codebuild.BuildSpec.fromObject(amplify_build_spec);

    const amplifyApp = new amplify.CfnApp(this, "AmplifyApp2", {
      name: "AmplifyApp2",
      repository: "https://github.com/kishanpatel13/react-test-app.git",
      oauthToken: "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",
      buildSpec: amplifyBuildSpec.toBuildSpec(),
    });

    new amplify.CfnBranch(this, "mainBranch", {
      branchName: "main",
      appId: amplifyApp.attrAppId,
    });
  }
}
