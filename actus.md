---
layout: home
title: "Actus"
permalink: /actus/
---

## Actualités

<ul class="kicker-list">
{% for post in site.posts %}
  <li>
    <a href="{{ post.url | relative_url }}">{{ post.title }}</a> — <span style="color:var(--paper-dim)">{{ post.date | date: "%d %B %Y" }}</span>
    <p class="post-excerpt">{{ post.excerpt | strip_html | strip | truncatewords: 40 }}</p>
    <a class="post-more" href="{{ post.url | relative_url }}">Lire la suite</a>
  </li>
{% endfor %}
</ul>
