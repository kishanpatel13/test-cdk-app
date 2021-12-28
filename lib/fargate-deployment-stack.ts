import {
  aws_ecs as ecs,
  aws_ec2 as ec2,
  aws_ecs_patterns as ecs_patterns,
  aws_ssm as ssm,
  App,
  StackProps,
  Stack,
  CfnOutput,
} from "aws-cdk-lib";

export interface FargateDeploymentStackProps extends StackProps {
  readonly image: ecs.ContainerImage;
}

export class FargateDeploymentStack extends Stack {
  constructor(scope: App, id: string, props: FargateDeploymentStackProps) {
    super(scope, id, props);

    // Create new VPC
    const vpc = new ec2.Vpc(this, "TestVPC", {
      vpcName: "test-vpc",
      maxAzs: 2,
      natGateways: 1,
    });

    // Create cluster for fargate service
    const cluster = new ecs.Cluster(this, "TestCluster", {
      clusterName: "test-cluster",
      vpc: vpc,
    });

    const ssmParameter = new ssm.StringParameter(this, "testParameter", {
      stringValue: "Hello World",
    });

    // Fargate service
    const backendService =
      new ecs_patterns.ApplicationLoadBalancedFargateService(
        this,
        "backendService",
        {
          cluster: cluster,
          memoryLimitMiB: 1024,
          cpu: 512,
          desiredCount: 1,
          taskImageOptions: {
            image: props.image,
            secrets: {
              testSecret: ecs.Secret.fromSsmParameter(ssmParameter),
            },
          },
        }
      );

    // Health check
    backendService.targetGroup.configureHealthCheck({ path: "/health" });

    // Load balancer url
    new CfnOutput(this, "loadBalancerUrl", {
      value: backendService.loadBalancer.loadBalancerDnsName,
      exportName: "loadBalancerUrl",
    });
  }
}
