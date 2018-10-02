const _ = require('lodash');

class ServerlessPluginConfigRule {
  constructor(serverless) {
    this.serverless = serverless;
    this.provider = this.serverless.getProvider('aws');

    this.hooks = {
      'package:compileEvents': this.compileEvents.bind(this),
    };
  }

  compileEvents() {
    const functions = this.serverless.service.getAllFunctions();

    functions.forEach((functionName) => {
      const functionObj = this.serverless.service.getFunction(functionName);

      functionObj.events.forEach((event) => {
        if (event.config) {
          let ruleName;
          let resourceTypes;
          if (typeof event.config === 'object') {
            if (!event.config.ruleName) {
              const errorMessage = [
                `Missing "ruleName" property for config event in function ${functionName}.`,
                ' The correct syntax is an object with "ruleName" property.',
                ' Please check the docs for more info.',
              ].join('');
              throw new this.serverless.classes
                .Error(errorMessage);
            }
            ruleName = event.config.ruleName;

            if (!event.config.resourceTypes) {
              const errorMessage = [
                `Missing "resourceTypes" property for config event in function ${functionName}.`,
                ' The correct syntax is an object with "resourceTypes" property.',
                ' Please check the docs for more info.',
              ].join('');
              throw new this.serverless.classes
                .Error(errorMessage); 
            }

            if (!_.isArray(event.config.resourceTypes)) {
              const errorMessage = [
                `resourceTypes property of function ${functionName} is not an array`,
                ' The correct syntax is: ',
                ' resourceTypes: ',
                '   - Value',
                ' Please check the docs for more info.',
              ].join('');
              throw new this.serverless.classes
                .Error(errorMessage);
            }
            resourceTypes = event.config.resourceTypes.join('');
          }

          const lambdaLogicalId = this.provider.naming.getLambdaLogicalId(functionName);
          const configRuleLogicalId = this.getConfigRuleLogicalId(functionName, event.config.ruleName);
          const lambdaPermissionlogicalId = this.getLambdaPermissionLogicalId(functionName, event.config.ruleName);

          const configTemplate = `
            {
              "Type": "AWS::Config::ConfigRule",
              "Properties": {
                "ConfigRuleName": "${ruleName}",
                "Scope": {
                  "ComplianceResourceTypes": [
                    "${resourceTypes}"
                  ]
                },
                "Source": {
                  "Owner": "CUSTOM_LAMBDA",
                  "SourceIdentifier": { "Fn::GetAtt": ["${lambdaLogicalId}", "Arn"]},
                  "SourceDetails":[
                    {
                      "EventSource": "aws.config",
                      "MessageType": "ConfigurationItemChangeNotification"
                    }
                  ]
                }
              },
              "DependsOn": ["${lambdaLogicalId}", "${lambdaPermissionlogicalId}"]
            }
          `;

          const permissionTemplate = `
            {
              "Type": "AWS::Lambda::Permission",
              "Properties": {
                "FunctionName": { "Fn::GetAtt": ["${lambdaLogicalId}", "Arn"] },
                "Action": "lambda:InvokeFunction",
                "Principal": "config.amazonaws.com"
              },
              "DependsOn": "${lambdaLogicalId}"
            }
          `;

          const newConfigRuleObject = {
            [configRuleLogicalId]: JSON.parse(configTemplate),
          };

          const newPermissionObject = {
            [lambdaPermissionlogicalId]: JSON.parse(permissionTemplate),
          };

          _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
            newConfigRuleObject, newPermissionObject);
        }
      });
    });

    const configStatement = {
      Effect: 'Allow',
      Action: [
        'config:GetResourceConfigHistory',
        'config:PutEvaluations',
      ],
      Resource: '*',
    };

    if (this.serverless.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution) {
      const statement = this.serverless.service.provider.compiledCloudFormationTemplate
        .Resources
        .IamRoleLambdaExecution
        .Properties
        .Policies[0]
        .PolicyDocument
        .Statement;
      statement.push(configStatement);
    }
  }

  getConfigRuleLogicalId(functionName, config) {
    const normalizedFunctionName = this.provider.naming.getNormalizedFunctionName(functionName);
    const normalizedConfigName = this.provider.naming.normalizeNameToAlphaNumericOnly(config);

    return `${normalizedFunctionName}ConfigRule${normalizedConfigName}`;
  }

  getLambdaPermissionLogicalId(functionName, config) {
    const normalizedFunctionName = this.provider.naming.getNormalizedFunctionName(functionName);
    const normalizedConfigName = this.provider.naming.normalizeNameToAlphaNumericOnly(config);

    return `${normalizedFunctionName}LambdaPermission${normalizedConfigName}`;
  }
}

module.exports = ServerlessPluginConfigRule;
