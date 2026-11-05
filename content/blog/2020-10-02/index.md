---
title: "Power Automate Custom Connector Series #1 – What3Words"
published: 2020-10-02T20:00:00Z
description: Sometimes I have a requirement for a custom connector and to be
  honest, sometimes I don’t but I like the API so I build one anyway as you
  never know when you’re going to need it! Back in 2019, I was fortunate enough
  to meet Ben Vollmer and we were
tags:
  - custom connectors
  - power automate
category: power automate
draft: false
---

Sometimes I have a requirement for a custom connector and to be honest, sometimes I don’t but I like the API so I build one anyway as you never know when you’re going to need it!

Back in 2019, I was fortunate enough to meet [Ben Vollmer](https://www.linkedin.com/in/benvollmer/) and we were talking someone, we got into a conversation about What3Words and ultimately, I ended up making a custom connector that we would both come to use. Over a year later, I figured it would be a great first choice for my custom connector series as it was the first one I ever built for fun.

**What is What3Words?**

Simply put, What3Words breaks the entire world into 3 metre squares and provides a unique combination for each one but in readable words for quick usages. The What3Words website gives some examples of users of the platform,including the emergency services, Network Rail and the delivery service Hermes (although that doesn’t help Hermes deliver my parcel on time but that’s a conversation for a different time!)

![](images/image-9.png)

<figcaption>Main image on What3Words site explaining the product</figcaption>

**What does the connector do?**

The API is beautifully simple and works in both directions – either latitude/longitude to What3Words or What3Words to latitude/longitude. Full documentation is here: [https://developer.what3words.com/public-api/docs#overview](https://developer.what3words.com/public-api/docs#overview) and you will need an API key for this connector to work.

The custom connector is available for you to download from here:

[https://github.com/mattybeard/PowerAutomate\_CustomConnectors/tree/master/What3Words](https://github.com/mattybeard/PowerAutomate_CustomConnectors/tree/master/What3Words)

**Example Usage**

This is a video of a What3Words canvas app which demonstrates latitude & longitude to What3Words and back again. It also updates the map and returns the nearest location in text if required.

This app is simple a canvas app calling one of two flows on button press – taking an input and returning a response.

![](images/image-10.png)

You’re welcome to use the connector as you see fit but for full disclosure I do not own the API driving the connector.
