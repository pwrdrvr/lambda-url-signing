import { Construct } from 'constructs';
import { Duration, RemovalPolicy, Tags } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';

interface ServiceProps {
  readonly isTestBuild?: boolean;

  /**
   * Optional lambda function name.
   * Also used for the CloudWatch LogGroup for the function.
   *
   * @default - auto assigned
   */
  readonly lambdaFuncServiceName?: string;

  /**
   * Automatically clean up durable resources (e.g. for PR builds).
   * @default false
   */
  readonly autoDeleteEverything?: boolean;

  /**
   * The amount of memory, in MB, that is allocated to your Lambda function.
   *
   * Lambda uses this value to proportionally allocate the amount of CPU power. For more information, see Resource Model in the AWS Lambda Developer Guide.
   *
   * 1769 MB is 1 vCPU seconds of credits per second
   *
   * @default 512
   */
  readonly memorySize?: number;
}

export interface IService {
  readonly serviceFunc: lambda.IFunction;
  readonly serviceFuncUrl: lambda.IFunctionUrl;
}

export class ServiceConstruct extends Construct implements IService {
  private _serviceFunc: lambda.Function;
  public get serviceFunc(): lambda.IFunction {
    return this._serviceFunc;
  }

  private _serviceFuncUrl: lambda.FunctionUrl;
  public get serviceFuncUrl(): lambda.IFunctionUrl {
    return this._serviceFuncUrl;
  }

  /**
   * Construct for the service that reads from DynamoDB
   * @param scope
   * @param id
   * @param props
   */
  constructor(scope: Construct, id: string, props: ServiceProps) {
    super(scope, id);

    const {
      autoDeleteEverything,
      lambdaFuncServiceName,
      memorySize = 512, // 1769 MB is 1 vCPU seconds of credits per second
      isTestBuild = false,
    } = props;

    //
    // Create the Lambda Function
    //
    this._serviceFunc = new lambdaNodejs.NodejsFunction(this, 'lambda-func', {
      entry: 'packages/lambda/src/index.ts',
      functionName: lambdaFuncServiceName,
      logRetention: logs.RetentionDays.ONE_MONTH,
      memorySize,
      timeout: Duration.seconds(10),
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
      tracing: lambda.Tracing.ACTIVE,
      runtime: lambda.Runtime.NODEJS_14_X,
      environment: {
        NODE_ENV: 'production', // This is used by next.js and is always 'production'
      },
      bundling: {
        minify: !isTestBuild,
        sourceMap: !isTestBuild,
        tsconfig: 'packages/lambda/tsconfig.json',
        format: lambdaNodejs.OutputFormat.ESM,
        // Thanks: https://github.com/evanw/esbuild/issues/253#issuecomment-1042853416
        target: 'node14.8',
      },
    });
    if (lambdaFuncServiceName !== undefined) {
      Tags.of(this._serviceFunc).add('Name', lambdaFuncServiceName);
    }
    if (autoDeleteEverything) {
      this._serviceFunc.applyRemovalPolicy(RemovalPolicy.DESTROY);
    }

    this._serviceFuncUrl = this._serviceFunc.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
    });
  }
}
