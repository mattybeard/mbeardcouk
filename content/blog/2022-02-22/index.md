---
title: "Power Automate Custom Connector Series #5 – RegExReplace"
published: 2022-02-22T13:02:22Z
description: It’s been a while… I’ve released a number of custom connectors in
  the past and whilst I’ve still been playing with custom connectors, it’s been
  a while since I’ve actually released one but it’s time again. This custom
  connector has a funny back story that starts in October 2021 during
tags: []
category: Power Platform
draft: false
---

It’s been a while…

I’ve released a number of custom connectors in the past and whilst I’ve still been playing with custom connectors, it’s been a while since I’ve actually released one but it’s time again.

This custom connector has a funny back story that starts in October 2021 during a conversation with [Keith Whatling](https://twitter.com/KeithWhatling). He had some Power Automate ideas and we both criticized how something that felt crucial to the platform was missing in the Power Automate expression language but during that conversation, a brain wave came around the custom code element of custom connectors which made me realise something – the API call itself can be made entirely irrelevant. So we had an idea and that little piece of knowledge wedged itself into my brain until…

I got a message off my fellow [Connector.Gallery](https://www.connector.gallery/) creator [Thomas Sandsor](https://twitter.com/crmkeeper) asking about regex replacement and how could it be done in Power Automate and, similar to my conversation with Keith, it became apparent that the Power Automate expression language cannot do it – but guess what? C# can!

So I asked Thomas to give me an hour and I took off my low code hat and put on my pro code beret and started to write code. Ultimately, C# has a [Regex.Replace](https://docs.microsoft.com/en-us/dotnet/api/system.text.regularexpressions.regex.replace?view=net-6.0#:~:text=The%20Regex.,a%20regular%20expression%20replacement%20pattern.) in the System.Text.RegularExpressions namespace and luckily for us, the custom code in a custom connector has [support for that namespace](https://docs.microsoft.com/en-us/connectors/custom-connectors/write-code)!

And this gave birth to the [RegExReplace connector](https://github.com/mattybeard/PowerAutomate_CustomConnectors/tree/master/RegexReplace) – it doesn’t do anything complex and is essentially a wrapper around the Regex.Replace call and returns the response. There is no API call made and all processing is done in the cloud (note: with a strict time constraint so watch that!).

I’m not the first person to do this, I’ve seen [Alex Shlega](https://twitter.com/ashlega) post at least 2 connectors doing the same thing – heavily focusing on the C# part to fill in the gaps so it’s great to see multiple people have the idea and doing the same sort of thing!

The GitHub page tells you have to install and use the connector so if you’re interested, [check it out here](https://github.com/mattybeard/PowerAutomate_CustomConnectors/tree/master/RegexReplace).
