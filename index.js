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
          let RuleName;
          let Description;
          let MessageType = 'ConfigurationItemChangeNotification';
          let MaximumExecutionFrequency;
          let resourceTypes;

          if (event.config.messageType === 'ScheduledNotification') {
            MaximumExecutionFrequency = 'TwentyFour_Hours';
          }

          if (typeof event.config === 'object') {
            if (event.config.messageType !== 'ScheduledNotification') {
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
            }

            RuleName = event.config.name;
            Description = event.config.description;
            MessageType = event.config.messageType || MessageType;
            resourceTypes = event.config.resourceTypes ? event.config.resourceTypes.join('') : null;
            MaximumExecutionFrequency = event.config.maxExecutionFrequency ? event.config.maxExecutionFrequency : MaximumExecutionFrequency;
          } else {
            const errorMessage = [
              `config event of function "${functionName}" is not an object`,
              ' Please check the docs for more info.',
            ].join('');
            throw new this.serverless.classes
              .Error(errorMessage);
          }

          const lambdaLogicalId = this.provider.naming.getLambdaLogicalId(functionName);
          const configRuleLogicalId = this.getConfigRuleLogicalId(functionName);
          const lambdaPermissionlogicalId = this.getLambdaPermissionLogicalId(functionName);

          let scopeTemplate = `
            "Scope": {
              "ComplianceResourceTypes": [
                "${resourceTypes}"
              ]
            },
          `;

          if (MessageType === 'ScheduledNotification') {
            scopeTemplate = '';
          }

          const configTemplate = `
            {
              "Type": "AWS::Config::ConfigRule",
              "Properties": {
                ${RuleName ? `"ConfigRuleName": "${RuleName}",` : ''}
                ${Description ? `"Description": "${Description}",` : ''}
                ${scopeTemplate}
                "Source": {
                  "Owner": "CUSTOM_LAMBDA",
                  "SourceIdentifier": { "Fn::GetAtt": ["${lambdaLogicalId}", "Arn"]},
                  "SourceDetails":[
                    {
                      "EventSource": "aws.config",
                      ${MaximumExecutionFrequency ? `"MaximumExecutionFrequency": "${MaximumExecutionFrequency}",` : ''}
                      "MessageType": "${MessageType}"                      
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

  getConfigRuleLogicalId(functionName) {
    return `${this
      .getNormalizedFunctionName(functionName)}ConfigRule`;
  }

  getLambdaPermissionLogicalId(functionName) {
    return `${this
      .getNormalizedFunctionName(functionName)}LambdaPermission`;
  }

  getNormalizedFunctionName(functionName) {
    return this.normalizeName(functionName
      .replace(/-/g, 'Dash')
      .replace(/_/g, 'Underscore'));
  }

  normalizeName(name) {
    return `${_.upperFirst(name)}`;
  }
}

module.exports = ServerlessPluginConfigRule;
