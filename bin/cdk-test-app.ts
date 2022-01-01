#!/usr/bin/env node
import "source-map-support/register";
import { App, Tags } from "aws-cdk-lib";
import { MyPipelineStack } from "../lib/backend-deploy-pipeline";
import { FargateDeploymentStack } from "../lib/fargate-deployment-stack";
import { AddAmplifyStack } from "../lib/add-amplify-stack";
import { FeDeploymentPipelineStack } from "../lib/fe-deploy-pipeline";
import { NewPipelineStack } from "../lib/new-pipeline";

const app = new App();

const pipelineStack = new MyPipelineStack(app, "MyPipelineStack", {
  backendRepository: {
    owner: "kishanpatel13",
    repo: "test-be-app",
    branch: "main",
    token: "github-token",
  },
  cdkRepository: {
    owner: "kishanpatel13",
    repo: "test-cdk-app",
    branch: "main",
    token: "github-token",
  },
});

Tags.of(pipelineStack).add("nameTag", "MyPipelineStack");

const fargateDeploymentStack = new FargateDeploymentStack(
  app,
  "FargateDeploymentStack",
  {
    image: pipelineStack.tagParameterContainerImage,
  }
);
Tags.of(fargateDeploymentStack).add("nameTag", "FargateDeploymentStack");

const amplifyStack = new AddAmplifyStack(app, "AddAmplifyStack", {
  repositoryUrl: "https://github.com/kishanpatel13/react-test-app",
  branch: "main",
  token: "github-token",
});
Tags.of(amplifyStack).add("nameTag", "AddAmplifyStack");

new FeDeploymentPipelineStack(app, "FeDeploymentPipelineStack", {
  feRepository: {
    owner: "kishanpatel13",
    repo: "react-test-app",
    branch: "main",
    token: "github-token",
  },
});

new NewPipelineStack(app, 'NewPipelineStack', {
  env: {
    account: '654547709207',
    region: 'us-west-1',
  }
});

app.synth();