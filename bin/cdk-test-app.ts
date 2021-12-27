#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MyPipelineStack } from "../lib/backend-deploy-pipeline";
import { FargateDeploymentStack } from "../lib/fargate-deployment-stack";

const app = new cdk.App();

const pipelineStack = new MyPipelineStack(app, "MyPipelineStack");

new FargateDeploymentStack(app, "FargateDeploymentStack", {
  image: pipelineStack.tagParameterContainerImage,
});
