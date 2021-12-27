import * as cdk from "@aws-cdk/core";
import * as amplify from "@aws-cdk/aws-amplify";
import * as codebuild from "@aws-cdk/aws-codebuild";
import * as amplify_build_spec from "./amplify_build_spec.json";

export class AddAmplifyStack1 extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const amplifyApp: amplify.App = new amplify.App(this, "AmplifyApp1", {
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: "kishanpatel13",
        repository: "react-test-app",
        oauthToken: new cdk.SecretValue(
          "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"
        ),
      }),
      buildSpec: codebuild.BuildSpec.fromObjectToYaml(amplify_build_spec),
    });

    amplifyApp.addBranch("main");
  }
}
