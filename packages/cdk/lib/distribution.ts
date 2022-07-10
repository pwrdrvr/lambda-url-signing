import { RemovalPolicy } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as cforigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as r53targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * Represents a CloudFront
 */
export interface IDistributionConstruct {
  /**
   * The CloudFront distribution
   */
  readonly cloudFrontDistro: cf.Distribution;
}

/**
 * Properties to initialize an instance of `DistributionConstruct`.
 */
export interface DistributionConstructProps {
  /**
   * RemovalPolicy override for child resources
   *
   * Note: if set to DESTROY the S3 buckes will have `autoDeleteObjects` set to `true`
   *
   * @default - per resource default
   */
  readonly removalPolicy?: RemovalPolicy;

  /**
   * S3 bucket for CloudFront logs
   */
  readonly bucketLogs?: s3.IBucket;

  /**
   * CloudFront Distribution domain name
   *
   * @example apps.pwrdrvr.com
   * @default auto-assigned
   */
  readonly domainNameEdge?: string;

  /**
   * Custom origin domain name
   *
   * @example apps.pwrdrvr.com
   */
  readonly domainNameOrigin: string;

  /**
   * ACM Certificate that covers `domainNameEdge` name
   */
  readonly certEdge?: acm.ICertificate;

  /**
   * Route53 zone in which to create optional `domainNameEdge` record
   */
  readonly r53Zone?: r53.IHostedZone;

  /**
   * Configuration of the edge to origin lambda functions
   *
   * @defaunt - no edge to origin functions added
   */
  readonly edgeToOriginLambdas?: cf.EdgeLambda[];
}

/**
 * Options for the `CreateAPIOriginPolicy`
 */
export interface CreateAPIOriginPolicyOptions {
  /**
   * Edge domain name used by CloudFront - If set, a custom
   * OriginRequestPolicy will be created that prevents
   * the Host header from being passed to the origin.
   */
  readonly domainNameEdge?: string;
}

/**
 * Create a new CloudFront Distribution.
 */
export class DistributionConstruct extends Construct implements IDistributionConstruct {
  private _cloudFrontDistro: cf.Distribution;
  public get cloudFrontDistro(): cf.Distribution {
    return this._cloudFrontDistro;
  }

  constructor(scope: Construct, id: string, props: DistributionConstructProps) {
    super(scope, id);

    if (props === undefined) {
      throw new Error('props must be set');
    }

    if (
      (props.r53Zone === undefined && props.domainNameEdge !== undefined) ||
      (props.r53Zone !== undefined && props.domainNameEdge === undefined)
    ) {
      throw new Error('If either of r53Zone or domainNameEdge are set then the other must be set');
    }

    const {
      domainNameEdge,
      domainNameOrigin,
      removalPolicy,
      certEdge,
      r53Zone,
      bucketLogs,
      edgeToOriginLambdas,
    } = props;

    //
    // CloudFront Distro
    //
    const httpOrigin = new cforigins.HttpOrigin(domainNameOrigin, {
      protocolPolicy: cf.OriginProtocolPolicy.HTTPS_ONLY,
      originSslProtocols: [cf.OriginSslPolicy.TLS_V1_2],
    });
    this._cloudFrontDistro = new cf.Distribution(this, 'cft', {
      comment: domainNameEdge,
      domainNames: domainNameEdge !== undefined ? [domainNameEdge] : undefined,
      certificate: certEdge,
      httpVersion: cf.HttpVersion.HTTP2,
      defaultBehavior: {
        allowedMethods: cf.AllowedMethods.ALLOW_ALL,
        cachePolicy: cf.CachePolicy.CACHING_DISABLED,
        compress: true,
        originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER,
        origin: httpOrigin,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        edgeLambdas: edgeToOriginLambdas,
      },
      enableIpv6: true,
      priceClass: cf.PriceClass.PRICE_CLASS_100,
      logBucket: bucketLogs,
      logFilePrefix: props.domainNameEdge ? `${props.domainNameEdge}/cloudfront-raw/` : undefined,
    });
    if (removalPolicy !== undefined) {
      this._cloudFrontDistro.applyRemovalPolicy(removalPolicy);
    }

    //
    // Create the edge name for the CloudFront distro
    //

    if (r53Zone !== undefined) {
      const rrAppsEdge = new r53.RecordSet(this, 'edge-arecord', {
        recordName: domainNameEdge,
        recordType: r53.RecordType.A,
        target: r53.RecordTarget.fromAlias(new r53targets.CloudFrontTarget(this._cloudFrontDistro)),
        zone: r53Zone,
      });
      if (removalPolicy !== undefined) {
        rrAppsEdge.applyRemovalPolicy(removalPolicy);
      }
    }
  }
}
