#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MyPipelineStack } from "../lib/backend-deploy-pipeline";
import { FargateDeploymentStack } from "../lib/fargate-deployment-stack";
import { AddAmplifyStack } from "../lib/add-amplify-stack";

const app = new cdk.App();

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

new FargateDeploymentStack(app, "FargateDeploymentStack", {
  image: pipelineStack.tagParameterContainerImage,
});

new AddAmplifyStack(app, "AddAmplifyStack", {
  repositoryUrl: "https://github.com/kishanpatel13/react-test-app.git",
  branch: "main",
  token: "github-token",
});
