# Contributing

To get set up to make changes to this project, simply clone and `npm install`. Then, the following scripts are available:

|Script|Purpose|
|------|-------|
|`npm run clean`|Clean dependencies and reinstall the project|
|`npm run build`|Transpile the code|
|`npm run lint`|Check the code for issues|
|`npm run test`|Run unit tests|
|`npm run test:e2e`|Run e2e tests (see note below)|
|`npm run watch`|Watch for code changes and transpile / run unit tests on change|

## Testing Changes with Appium

The best way to test changes is in an instance of Appium.0. To link up this project with your Appium server, run the following command from inside the project repo (you may need to `appium driver uninstall` any previous instances; replace `$(pwd)` with the full path to your repo if the command isn't supported in your shell):

```
appium driver install --source=local $(pwd)
```

Now, all you need to do is `npm run build` anytime you make changes to the driver, and then restart the Appium server to pick up those changes (no reinstall needed).

## Running E2E Tests

By default, the E2E tests don't know how to connect to your Roku device, so you'll need to make sure to have the following environment variables set when you run `npm run test:e2e`, to populate the capabilities correctly:

|Env Var|Corresponding Capability|
|-------|------------------------|
|`RK_HOST`|`rokuHost`|
|`RK_PORT`|`rokuPort`|
|`RK_WEB_PORT`|`rokuWebPort`|
|`RK_USER`|`rokuUser`|
|`RK_PASS`|`rokuPass`|
|`RK_HEADER_HOST`|`rokuHeaderHost`|

## Proposing Changes

Once you've got your change coded up, and you've added tests, run lint, etc..., go ahead and [make a pull request](https://github.com/projectxyzio/appium-roku-driver/pulls)!
