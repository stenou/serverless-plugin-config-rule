const expect = require('chai').expect;
const Serverless = require('serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const AwsCompileScheduledEvents = require('../index');

describe('AwsCompileScheduledEvents', () => {
  let serverless;
  let awsCompileEvents;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.setProvider('aws', new AwsProvider(serverless));
    awsCompileEvents = new AwsCompileScheduledEvents(serverless);
    awsCompileEvents.serverless.service.service = 'new-service';
  });

  describe('#constructor()', () => {
    it('should set the provider variable to an instance of AwsProvider', () => {
      expect(awsCompileEvents.provider).to.be.instanceof(AwsProvider);
    });
  });

  describe('#compileScheduledEvents()', () => {
    it('should create resources when MessageType is ScheduledNotification', () => {
      awsCompileEvents.serverless.service.functions = {
        first: {
          events: [
            {
              config: {
                name: 'elasticbeanstalk-platform-version',
                messageType: 'ScheduledNotification',
              },
            },
          ],
        },
      };

      awsCompileEvents.compileEvents();

      expect(awsCompileEvents.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.FirstConfigRule.Type
      ).to.equal('AWS::Config::ConfigRule');
      expect(awsCompileEvents.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.FirstConfigRule.Properties.Source.SourceDetails[0].MessageType
      ).to.equal('ScheduledNotification');
      expect(awsCompileEvents.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.FirstConfigRule.Properties.Source.SourceDetails[0].MaximumExecutionFrequency
      ).to.equal('TwentyFour_Hours');

      expect(awsCompileEvents.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.FirstLambdaPermission.DependsOn
      ).to.equal('FirstLambdaFunction');
    });

    it('should thrown an error when resourceTypes is undefined', () => {
      awsCompileEvents.serverless.service.functions = {
        first: {
          events: [
            {
              config: {
                name: 'elasticbeanstalk-platform-version',
                messageType: 'ConfigurationItemChangeNotification',
              },
            },
          ],
        },
      };

      expect(() => awsCompileS3Events.compileS3Events()).to.throw(Error);
    });

    it('should create resources when MessageType is ConfigurationItemChangeNotification', () => {
      awsCompileEvents.serverless.service.functions = {
        first: {
          events: [
            {
              config: {
                name: 'elasticbeanstalk-platform-version',
                messageType: 'ConfigurationItemChangeNotification',
                resourceTypes: [
                  "AWS::ElasticBeanstalk::Environment"
                ],
              },
            },
          ],
        },
      };

      awsCompileEvents.compileEvents();

      expect(awsCompileEvents.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.FirstConfigRule.Type
      ).to.equal('AWS::Config::ConfigRule');
      expect(awsCompileEvents.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.FirstConfigRule.Properties.Source.SourceDetails[0].MessageType
      ).to.equal('ConfigurationItemChangeNotification');
      expect(awsCompileEvents.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.FirstConfigRule.Properties.Scope
      ).to.deep.equal({ "ComplianceResourceTypes": ["AWS::ElasticBeanstalk::Environment"]});

      expect(awsCompileEvents.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.FirstLambdaPermission.DependsOn
      ).to.equal('FirstLambdaFunction');
    });

    it('should respect name', () => {
      awsCompileEvents.serverless.service.functions = {
        first: {
          events: [
            {
              config: {
                name: 'elasticbeanstalk-platform-version',
                messageType: 'ScheduledNotification',
              },
            },
          ],
        },
      };

      awsCompileEvents.compileEvents();

      expect(awsCompileEvents.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.FirstConfigRule.Properties.ConfigRuleName
      ).to.equal('elasticbeanstalk-platform-version');
    });

    it('should respect description', () => {
      awsCompileEvents.serverless.service.functions = {
        first: {
          events: [
            {
              config: {
                name: 'elasticbeanstalk-platform-version',
                description: 'test',
                messageType: 'ScheduledNotification',
              },
            },
          ],
        },
      };

      awsCompileEvents.compileEvents();

      expect(awsCompileEvents.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.FirstConfigRule.Properties.Description
      ).to.equal('test');
    });

    it('should not create corresponding resources when cloudwatch events are not given', () => {
      awsCompileEvents.serverless.service.functions = {
        first: {
          events: [],
        },
      };

      awsCompileEvents.compileEvents();

      expect(
        awsCompileEvents.serverless.service.provider.compiledCloudFormationTemplate
          .Resources
      ).to.deep.equal({});
    });
  });
});
