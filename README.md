# Appium Roku Driver

This project is an Appium 2.x driver for automation of Roku dev channels (in the Roku world, "channel" means "app").

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
appium driver install --source=npm appium-roku-driver
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

## Implemented Commands

### Roku Commands

## Contributing

We would love for you to contribute to this project! Check out the [contribution guide](CONTRIBUTING.md) for more info.
