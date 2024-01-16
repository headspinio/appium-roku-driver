# Appium Roku Driver

This project is an Appium 2.x driver for automation of Roku channels (in the Roku world, "channel" means "app").

## Background

Roku's [developer portal](https://developer.roku.com/en-ca/docs/developer-program/getting-started/roku-dev-prog.md) is essential reading for using this driver well. As with any Appium driver, the more knowledge you have on how the underlying platform works, including development experience on that platform, the more successful you will be in troubleshooting any issues that arise during use of the driver.

To support its features, the Appium Roku Driver uses the following technologies provided by Roku:

*  [Developer mode and the developer utility interface](https://developer.roku.com/en-ca/docs/developer-program/getting-started/developer-setup.md)
* The [External Control Protocol](https://developer.roku.com/en-ca/docs/developer-program/debugging/external-control-api.md)
* The [debug console](https://developer.roku.com/en-ca/docs/developer-program/debugging/debugging-channels.md)

Roku also provides its own [WebDriver implementation](https://developer.roku.com/en-ca/docs/developer-program/dev-tools/automated-channel-testing/web-driver.md), however it is lacking in many respects and doesn't respect the WebDriver standard, nor is it Appium-compatible. The Appium team recommends this driver instead, for the time being.

## Requirements

Before using the driver, please ensure the following are in place:

* Your Roku device has [developer mode enabled](https://developer.roku.com/en-ca/docs/developer-program/getting-started/developer-setup.md)
* You have access to your dev channel code in the `.zip` format expected by the Roku dev sideload utility
* The Roku device is accessible via TCP/IP from the machine where the Appium server is running (further, if you are SSH-tunneling to Roku dev ports via another machine, you'll need the IP address of the Roku on its local network)
* You have a working and updated Appium 2.0 server

## Limitations

We are limited to working with the tools that Roku has provided, which means many traditional ways of working with UI-based applications are off the table. As a set of examples:

* It is not possible to work directly with UI element objects. Appium provides element objects as a convenience only.
* It is not possible to retrieve the source or screenshot of an app which is not your dev channel.
* Only one dev channel may be sideloaded at a time
* Screenshots taken which include videos will not include video content for DRM reasons.

## Installation

With Appium 2.0's driver CLI, installation is as easy as:

```
appium driver install --source=npm @headspinio/appium-roku-driver
```

## Capabilities

|Capability|Type|Description|Required|
|----------|----|-----------|--------|
|`platformName`|string|Appium requires this. To activate this driver, it must be `Roku`|Yes|
|`appium:automationName`|string|Appium requires this. To activate this driver, it must be `roku`|Yes|
|`appium:app`|string|Absolute path to zip file of dev channel. If not included, a session will simply be started on the home screen|No|
|`appium:rokuHost`|string|The host name or IP of the Roku device|Yes|
|`appium:rokuEcpPort`|number|The ECP port on the Roku device (usually 8060)|Yes|
|`appium:rokuWebPort`|number|The dev web interface port on the Roku device (usually 80)|Yes|
|`appium:rokuUser`|string|The username you selected when turning on dev mode|Yes|
|`appium:rokuPass`|string|The password you selected when turning on dev mode|Yes|
|`appium:rokuHeaderHost`|string|The IP of the Roku device on its local network (usually the same as `rokuHost` unless you are tunneling or connecting via DNS)|Yes|
|`appium:keyCooldown`|number|The number of milliseconds to wait between remote key presses. Can be useful for waiting to ensure the UI catches up with the remote. Defaults to 0.|No|

## Supported Commands

The following table details the commands available via this driver. The command name is simply the internal Appium command name; it is not necessarily what you would call from your client code. Visit your client's documentation to see how you would call these commands from, e.g., the Java or Python client.

|Command|Parameters|Description|
|-------|----------|-----------|
|`createSession`||Start an Appium session on the Roku. If no `appium:app` capability is provided, the session will simply begin at the Home screen. If an `appium:app` capability is provided, the app will be sideloaded and launched.|
|`deleteSession`||Stop the Appium session, which basically entails going to the home screen.|
|`installApp`|`appPath`|Sideload the app found at `appPath` to the Roku. Installing an app causes the Roku to remove any previously sideloaded app.|
|`removeApp`|`appId`|Remove the app whose id is `appId`. The id should be the one returned in the call to `roku: getApps` (see below)|
|`activateApp`|`appId`, `contentId` (optional), `mediaType` (optional)|Launch the app whose id is `appId`. You can optionally include content ID and media type parameters as defined in Roku's [deep linking docs](https://developer.roku.com/en-ca/docs/developer-program/debugging/external-control-api.md#deep-linking-to-a-channel) (you do not need to URL-encode the value of `contentId`; the driver will do that for you).|
|`getPageSource`||Return the XML representation of the current app hierarchy. Only available if the sideloaded dev app is active.|
|`getScreenshot`||Return a base64-encoded string representing a PNG screenshot image. Only available if the sideloaded dev app is active.|`findElement`|`strategy`, `selector`|Find an element in the app hierarchy matching `selector`. Only the `xpath` strategy is supported. If no matching element is found, the driver will respond with a `NoSuchElement` error.|
|`findElements`|`strategy`, `selector`|Find a (possibly-empty) list of elements in the app hierarchy matching `selector`. Only the `xpath` strategy is supported.|

### Element Commands

Once you have an element ID, you can run these commands as well:

|Command|Parameters|Description|
|-------|----------|-----------|
|`click`|`elementId`|Check whether the element represented by `elementId` is marked as focused in the source XML. If not, determine which remote keypress will move the focus closer to the desired element. Repeat this process until the element is focused, and press the 'Select' button.|
|`sendKeys`|string|Set the given value to the element|
|`getAttribute`|string, `elementId`|Return the value of attribute key `string` of the element represented by `elementId`. If attribute key is not present for the element, method will return null|
|`getText`|`elementId`|Return the value of the `text` attribute for an element. If the `text` attribute is not present, this method will return null.|

A note about stale element references: when you attempt to `click` an element, the driver will retrieve the current app source XML, and attempt to re-find the element based on the original locator criteria. If the find results in an XML node that matches the element reference, all is well. If not, the driver understands the element hierarchy to have changed and will respond with a Stale Element Exception.

### Roku Commands

Using the Roku APIs listed above, we have access to functionality that goes beyond standard Appium protocol commands. This extra functionality is made available via the `executeScript` command. This command takes a string (the script), and an array of objects (the arguments for the script) as parameters.

These special Roku commands all follow the same format: their script string should start with `roku: `, and they should have a single argument in the argument list, which is an object whose values represent the command arguments. Let's take, for example, the `roku: pressKey` command. To press the `Home` key, we need to execute the `roku: pressKey` script, and the argument should be an array with a single element, namely an object of the form `{"key": "Home"}`. In the WebdriverIO client bindings, this would look like:

```js
await driver.executeScript('roku: pressKey', [{key: 'Home'}])
```

(And of course it would look different in every other language/library).

|Command|Parameters|Description|
|-------|----------|-----------|
|`roku: pressKey`|`key`|Press the remote key whose value matches `key` (must be one of the [supported key values](https://developer.roku.com/en-ca/docs/developer-program/debugging/external-control-api.md#keypress-key-values) from the Roku documentation). As addressed in the documentation, Roku TVs also support additioanl keys such as `PowerOff` and `PowerOn`. |
|`roku: deviceInfo`||Get information about the Roku device|
|`roku: getApps`||Get a list of apps installed on the device. The response will be a list of objects with the following keys: `id`, `type`, `subtype`, `version`, and `name`.|
|`roku: activeApp`||Get information about the active app, in the same format as `roku: getApps`.|
|`roku: activateApp`|`appId` (required), `contentId`, `mediaType`|Launch an app with the corresponding `appId`. Optionally include `contentId` and `mediaType` information (with the same properties as described above for the `activateApp` command)|
|`roku: selectElement`|`elementId` (required) |Moves the focus on a element having locator xpath as `elementId`. If it is unable to focus on the element, the driver will respond with a error.|
|`roku: playerState`||Get the state of the media player. The data will be returned as a JSON object, corresponding to the information included in the [query/media-player ECP result](https://developer.roku.com/en-ca/docs/developer-program/dev-tools/external-control-api.md#querymedia-player-example)|

## Contributing

We would love for you to contribute to this project! Check out the [contribution guide](CONTRIBUTING.md) for more info.

## Credits

* Development for this driver is sponsored by [HeadSpin](https://headspin.io).
* Special thanks to [@sharkyStudy](https://github.com/sharkyStudy) for help with the NPM package as well as developing another implementation in parallel before joining to assist with this project.
