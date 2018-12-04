# Serverless Plugin AWS Config Rule Event

A Serverless plugin to add an AWS Config Rule event.

## Installation
```
npm install --save-dev @stenou/serverless-plugin-config-rule
```

Add the plugin to serverless.yml:

```yaml
plugins:
  - '@stenou/serverless-plugin-config-rule'
```

## Usage

```yaml
functions:
  doSomething:
    handler: doSomething.handler
    events:
      - config:
          name: ElasticBeanstalkPlatformVersion
          description: "Checks ElasticBeanstalk Platform Version"
          resourceTypes:
            - "AWS::ElasticBeanstalk::Environment"
```