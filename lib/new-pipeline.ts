import { SecretValue, Stack, StackProps, } from "aws-cdk-lib";
import { CodePipeline, CodePipelineSource, ShellStep } from "aws-cdk-lib/pipelines";
import { Construct } from "constructs";
import { MyPipelineAppStage } from "./new-pipeline-app-stage";

export class NewPipelineStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const pipeline = new CodePipeline(this, 'Pipeline', {
            pipelineName: 'MyPipeline',
            synth: new ShellStep('Synth', {
                input: CodePipelineSource.gitHub('kishanpatel13/test-cdk-app', 'main', {
                    authentication: new SecretValue("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"),
                }),
                commands: ['npm ci', 'npm run build', 'npx cdk synth']
            })
        });

        pipeline.addStage(new MyPipelineAppStage(this, "TestLambdaDev"))
    }
}
