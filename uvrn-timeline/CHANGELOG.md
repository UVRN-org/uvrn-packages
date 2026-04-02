# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-01

Initial release. Time-series claim history queries and chart shaping for UVRN.

### Added
- `Timeline` query API with hourly, daily, and weekly bucketing
- `TimelineStore` interface for any backing store
- `MockTimelineStore` in-memory implementation
- chart.js and recharts compatible chart output with canon markers
