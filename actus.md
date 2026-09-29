---
layout: home
title: "Actus"
permalink: /actus/
---

## Actualités

<ul class="kicker-list">
{% for post in site.posts %}
  <li><a href="{{ post.url | relative_url }}">{{ post.title }}</a> — <span style="color:var(--paper-dim)">{{ post.date | date: "%d %B %Y" }}</span></li>
{% endfor %}
</ul>
