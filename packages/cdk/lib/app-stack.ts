import { Construct } from 'constructs';
import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { ServiceConstruct, IService } from './service-construct';
import { DistributionConstruct } from './distribution';
import { EdgeToOriginConstruct } from './edge-to-origin';

interface AppProps extends StackProps {
  readonly local: {
    readonly removalPolicy: RemovalPolicy;
  };
}

export interface IAppStack {
  readonly service: IService;
}

export class AppStack extends Stack implements IAppStack {
  private _service: ServiceConstruct;
  public get service(): ServiceConstruct {
    return this._service;
  }

  private _distribution: DistributionConstruct;
  public get distribution(): DistributionConstruct {
    return this._distribution;
  }

  private _edgeToOrigin: EdgeToOriginConstruct;
  public get edgeToOrigin(): EdgeToOriginConstruct {
    return this._edgeToOrigin;
  }

  constructor(scope: Construct, id: string, props: AppProps) {
    super(scope, id, props);

    const { removalPolicy } = props.local;

    //
    // Create an origin lambda
    //
    this._service = new ServiceConstruct(this, 'service', {
      memorySize: 512,
      removalPolicy: props.local.removalPolicy,
      isTestBuild: process.env.TEST_BUILD ? true : false,
    });

    //
    // Create an edge signing function
    //
    this._edgeToOrigin = new EdgeToOriginConstruct(this, 'edge-to-origin', {
      signingMode: 'sign',
      lambdaOriginFuncUrl: this._service.serviceFuncUrl,
      originRegion: props.env?.region,
      addXForwardedHostHeader: true,
      replaceHostHeader: true,
      removalPolicy,
    });

    //
    // Create a distribution
    //
    this._distribution = new DistributionConstruct(this, 'distribution', {
      domainNameOrigin: this._service.serviceUrl,
      removalPolicy,
      edgeToOriginLambdas: this._edgeToOrigin.edgeToOriginLambdas,
    });

    new CfnOutput(this, 'service-url', {
      value: this._service.serviceFuncUrl.url,
      exportName: `${this.stackName}-service-url`,
    });
  }
}
