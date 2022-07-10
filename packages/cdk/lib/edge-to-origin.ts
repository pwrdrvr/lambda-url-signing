import { existsSync, writeFileSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Aws, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * Represents a Edge to Origin Function
 */
export interface IEdgeToOriginConstruct {
  /**
   * The edge to origin function for signing requests
   *
   * The generated `config.yml` is included in the Lambda's code.
   */
  readonly edgeToOriginFunction: lambda.Function | cf.experimental.EdgeFunction;

  /**
   * Configuration of the edge to origin lambda functions
   */
  readonly edgeToOriginLambdas: cf.EdgeLambda[];
}

/**
 * Properties to initialize an instance of `EdgeToOrigin`.
 */
export interface EdgeToOriginProps {
  /**
   * RemovalPolicy override for child resources
   *
   * @default - per resource default
   */
  readonly removalPolicy?: RemovalPolicy;

  /**
   * Origin lambda URL
   */
  readonly lambdaOriginFuncUrl: lambda.IFunctionUrl;

  /**
   * Adds an X-Forwarded-Host-Header when calling API Gateway
   *
   * Can only be trusted if `signingMode` is enabled, which restricts
   * access to API Gateway to only IAM signed requests.
   *
   * Note: if true, creates OriginRequest Lambda @ Edge function for API Gateway Origin
   * @default true
   */
  readonly addXForwardedHostHeader?: boolean;

  /**
   * Replaces Host header (which will be the Edge domain name) with the Origin domain name
   * when enabled.  This is necessary when API Gateway has not been configured
   * with a custom domain name that matches the exact domain name used by the CloudFront
   * Distribution AND when the OriginRequestPolicy.HeadersBehavior is set
   * to pass all headers to the origin.
   *
   * Note: if true, creates OriginRequest Lambda @ Edge function for API Gateway Origin
   * @default true
   */
  readonly replaceHostHeader?: boolean;

  /**
   * Requires IAM auth on the API Gateway origin if not set to 'none'.
   *
   * 'sign' - Uses request headers for auth.
   * 'presign' - Uses query string for auth.
   *
   * If enabled,
   *
   * Note: if 'sign' or 'presign', creates OriginRequest Lambda @ Edge function for API Gateway Origin
   * @default 'sign'
   */
  readonly signingMode?: 'sign' | 'presign' | 'none';

  /**
   * Origin region that API Gateway and Function URL will be deployed to, used
   * for the config.yml on the Edge function to sign requests for
   * the correct region
   *
   * @default undefined
   */
  readonly originRegion?: string;
}

export interface GenerateEdgeToOriginConfigOptions {
  readonly originRegion: string;
  readonly signingMode: 'sign' | 'presign' | '';
  readonly addXForwardedHostHeader: boolean;
  readonly replaceHostHeader: boolean;
}

/**
 * Create a new  Edge to Origin Function w/ `config.yml`
 */
export class EdgeToOriginConstruct extends Construct implements IEdgeToOriginConstruct {
  /**
   * Generate the yaml config for the edge lambda
   * @param props
   * @returns
   */
  public static generateEdgeToOriginConfig(props: GenerateEdgeToOriginConfigOptions) {
    return `originRegion: ${props.originRegion}
${props.signingMode === '' ? '' : `signingMode: ${props.signingMode}`}
addXForwardedHostHeader: ${props.addXForwardedHostHeader}
replaceHostHeader: ${props.replaceHostHeader}`;
  }

  private _edgeToOriginFunction: lambda.Function | cf.experimental.EdgeFunction;
  public get edgeToOriginFunction(): lambda.Function | cf.experimental.EdgeFunction {
    return this._edgeToOriginFunction;
  }

  private _edgeToOriginLambdas: cf.EdgeLambda[];
  public get edgeToOriginLambdas(): cf.EdgeLambda[] {
    return this._edgeToOriginLambdas;
  }

  constructor(scope: Construct, id: string, props: EdgeToOriginProps) {
    super(scope, id);

    if (props === undefined) {
      throw new Error('props must be set');
    }

    const {
      removalPolicy,
      signingMode = 'sign',
      addXForwardedHostHeader = true,
      replaceHostHeader = true,
      originRegion,
    } = props;

    // Create the edge function config file from the construct options
    const edgeToOriginConfigYaml = EdgeToOriginConstruct.generateEdgeToOriginConfig({
      originRegion: originRegion || Aws.REGION,
      addXForwardedHostHeader,
      replaceHostHeader,
      signingMode: signingMode === 'none' ? '' : signingMode,
    });

    //
    // Create the Edge to Origin Function
    //
    const edgeToOriginFuncProps: Omit<lambda.FunctionProps, 'handler' | 'code'> = {
      memorySize: 1769,
      logRetention: logs.RetentionDays.ONE_MONTH,
      runtime: lambda.Runtime.NODEJS_14_X,
      timeout: Duration.seconds(5),
      ...(removalPolicy ? { removalPolicy } : {}),
    };
    if (
      process.env.NODE_ENV === 'test' &&
      existsSync(path.join(__dirname, '..', '..', 'edge-to-origin', 'dist', 'index.mjs'))
    ) {
      // Emit the config file from the construct options
      writeFileSync(
        path.join(__dirname, '..', '..', 'edge-to-origin', 'dist', 'config.yml'),
        edgeToOriginConfigYaml,
      );
      // This is for tests run under jest
      // This is also for anytime when the edge function has already been bundled
      this._edgeToOriginFunction = new cf.experimental.EdgeFunction(this, 'edge-to-origin-func', {
        code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'edge-to-origin', 'dist')),
        handler: 'index.handler',
        ...edgeToOriginFuncProps,
      });
    } else if (
      existsSync(path.join(__dirname, '..', '..', '..', 'distb', 'edge-to-origin', 'index.mjs'))
    ) {
      // Emit the config file from the construct options
      writeFileSync(
        path.join(__dirname, '..', '..', '..', 'distb', 'edge-to-origin', 'config.yml'),
        edgeToOriginConfigYaml,
      );

      // This is for bundling the version build with `rollup` for the
      // US-East-1 Lambda @ Edge function
      // We can't use
      this._edgeToOriginFunction = new cf.experimental.EdgeFunction(this, 'edge-to-origin-func', {
        code: lambda.Code.fromAsset(
          path.join(__dirname, '..', '..', '..', 'distb', 'edge-to-origin'),
        ),
        handler: 'index.handler',
        ...edgeToOriginFuncProps,
      });
    } else {
      // Emit the config file from the construct options
      writeFileSync(
        path.join(__dirname, '..', '..', 'edge-to-origin', 'config.yml'),
        edgeToOriginConfigYaml,
      );

      // This builds the function for distribution with the CDK Construct
      // and will be used during local builds and PR builds of core
      // if the edge-to-origin function is not already bundled.
      // This will fail to deploy in any region other than us-east-1
      // We cannot use NodejsFunction because it will not create in us-east-1
      this._edgeToOriginFunction = new lambdaNodejs.NodejsFunction(this, 'edge-to-origin-func', {
        entry: path.join(__dirname, '..', '..', 'edge-to-origin', 'src', 'index.ts'),
        handler: 'handler',
        bundling: {
          minify: true,
          sourceMap: true,
          commandHooks: {
            beforeInstall: () => [],
            beforeBundling: () => [],
            afterBundling: (_inputDir: string, outputDir: string) => {
              return [
                `${os.platform() === 'win32' ? 'copy' : 'cp'} ${path.join(
                  __dirname,
                  '..',
                  '..',
                  '..',
                  'configs',
                  'edge-to-origin',
                  'config.yml',
                )} ${outputDir}`,
              ];
            },
          },
        },
        ...edgeToOriginFuncProps,
      });
    }

    // Allow Lambda @ Edge to invoke this function
    // 2021-03-19 - For some reason this was recently removed from the defaults
    // for a Lambda function and now has to be allowed explicitly
    // const edgeLambdaPolicy = new iam.PolicyStatement();
    // edgeLambdaPolicy.addActions('sts:AssumeRole');
    // edgeLambdaPolicy.addServicePrincipal('edgelambda.amazonaws.com');
    // (this._edgeToOriginFunction.role as unknown as iam.Role).assumeRolePolicy?.addStatements(
    //   edgeLambdaPolicy,
    // );

    // Allow the Lambda to invoke the origin function via URL
    if (props.lambdaOriginFuncUrl) {
      props.lambdaOriginFuncUrl.grantInvokeUrl(this._edgeToOriginFunction);
    }
    // if (props.httpApiRoute) {
    //   // This generates the wrong permission: /*/*/ when it should be /*/*
    //   props.httpApiRoute.grantInvoke(this._edgeToOriginFunction, {
    //     httpMethods: [apigwy.HttpMethod.ANY],
    //   });
    // }

    this._edgeToOriginLambdas = [
      {
        eventType: cf.LambdaEdgeEventType.ORIGIN_REQUEST,
        functionVersion: this._edgeToOriginFunction.currentVersion,
        includeBody: true,
      },
    ];
  }
}
