import { Construct } from 'constructs';
import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { TimeToLive } from '@cloudcomponents/cdk-temp-stack';
import { ServiceConstruct, IService } from './service-construct';

interface AppProps extends StackProps {
  readonly local: {
    /**
     * Time after which to automatically delete all resources.
     */
    readonly ttl?: Duration;
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

  constructor(scope: Construct, id: string, props: AppProps) {
    super(scope, id, props);

    const { local } = props;
    const { ttl } = local;

    // Set stack to delete if this is a PR build
    if (ttl !== undefined) {
      new TimeToLive(this, 'TimeToLive', {
        ttl,
      });
    }

    //
    // Create a lambda
    //
    this._service = new ServiceConstruct(this, 'service', {
      memorySize: 512,
      autoDeleteEverything: ttl !== undefined,
      isTestBuild: process.env.TEST_BUILD ? true : false,
    });

    new CfnOutput(this, 'service-url', {
      value: this._service.serviceFuncUrl.url,
      exportName: `${this.stackName}-service-url`,
    });
  }
}
