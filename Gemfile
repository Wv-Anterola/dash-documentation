source "https://rubygems.org"

# Jekyll builds this site. GitHub Pages serves it from `main` using the
# `remote_theme` setting in _config.yml, not these gems, so if you bump
# just-the-docs here, check that the deployed site still renders too.
gem "jekyll", "~> 4.4"
gem "just-the-docs", "~> 0.12"

group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.17"
  gem "jekyll-seo-tag", "~> 2.8"
end

# Windows and JRuby don't ship zoneinfo files.
gem "tzinfo-data", platforms: [:windows, :jruby]
