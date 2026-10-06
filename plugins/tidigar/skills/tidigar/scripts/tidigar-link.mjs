/* Tidigar share links for AI agents and scripts, version 1.
   https://tidigar.com/llms.txt explains how to use this module.

   Run it with Node.js 20 or later, Deno or Bun:

     node tidigar-link.mjs plan.json           build a link from a plan or payload
     node tidigar-link.mjs - < plan.json       the same, from standard input
     node tidigar-link.mjs --embed plan.json   also print embed code
     node tidigar-link.mjs --read "<link>" > plan.json   read a link as a plan
     node tidigar-link.mjs --read --payload "<link>"   ... as a share-link payload

   Or import it: createLink(input), readLink(link), embedCode(link, title).
   The input is a plan, with real dates and names (schema/plan-v1.json), or
   a share-link payload (schema/share-link-v1.json).
   It validates a roadmap with the same code Tidigar uses when it opens a
   link, so a link it returns opens. Nothing is sent anywhere. */

const scope = { crypto: globalThis.crypto };
(function (globalThis) {
/*
 * Tidigar's storage model.
 *
 * The browser editor and the native adapter use this module as the boundary
 * between user supplied JSON and application state.  The module deliberately
 * has no DOM, localization, or platform dependencies.  When loaded as a
 * script it publishes `globalThis.tidigarModel`; CommonJS consumers receive
 * the same object from `require('./model/project.js')`.
 *
 * The canonical project shape is:
 *
 *   {
 *     manifest: {
 *       projectId, formatVersion, name, description, dimensions, year
 *     },
 *     items, sharedViews, milestones, periodIndicators
 *   }
 *
 * Normalization is intentionally a whitelist operation.  It creates a deep
 * canonical copy and drops fields that are not part of the storage contract.
 * Domain fields are validated, while the personal view-state helpers below
 * only sanitize ordinary JSON values and do not apply project validation.
 */

(function installtidigarModel(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.tidigarModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createtidigarModel(root) {
  'use strict';

  const DAY = 86400000;
  const MIN_DATE = '1900-01-01';
  const MAX_DATE = '2200-12-31';
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
  const VIEWS = new Set(['grid', 'timeline', 'list', 'flow']);
  const RESOLUTIONS = new Set(['year', 'quarter', 'month', 'week']);
  const TEXT_MODES = new Set(['hide', 'beside', 'run-past', 'fit', 'under', 'wrapped']);
  const ACTIVITY_ROW_MODES = new Set(['single', 'single-label', 'compact']);
  const MILESTONE_MODES = new Set(['hide', 'marker', 'label']);
  const WEEK_DAY_MODES = new Set(['work', 'all']);
  const DEPENDENCY_ARROW_MODES = new Set(['none', 'grouped', 'every']);
  const FLOW_DIRECTIONS = new Set(['auto', 'horizontal', 'vertical']);
  const SCHEDULES = new Set(['calendar-days', 'work-days']);
  // Values renamed when their default changed. Reading one gives the new
  // default, so stored views, calendars and links take up the new look once;
  // a choice made afterwards uses the new name and stays.
  const RENAMED_VIEW_VALUES = Object.freeze({
    timelineMilestoneMode: Object.freeze({ show: 'label' }),
    // Every earlier label choice reads as the title beside a short bar, the
    // default since 2026-09-29; running past the bar is now `run-past`.
    textMode: Object.freeze({
      below: 'beside',
      clip: 'beside',
      overflow: 'beside',
      wrap: 'beside',
    }),
    // Every earlier choice reads as the arrows within groups, the default
    // since 2026-10-02; no arrows is now `none`.
    timelineDependencyArrows: Object.freeze({
      activities: 'grouped',
      all: 'grouped',
      groups: 'grouped',
      off: 'grouped',
    }),
  });
  const currentViewValue = (field, value) => RENAMED_VIEW_VALUES[field][value] ?? value;
  const PROGRESS_VALUES = new Set([0, 25, 50, 75, 100]);
  // Allowed values of enumerated fields, published read-only so the model
  // specification test can compare them with docs/model-spec.md.
  const ENUM_VALUES = Object.freeze({
    'item.progress': Object.freeze([...PROGRESS_VALUES]),
    'manifest.schedule': Object.freeze([...SCHEDULES]),
    'view.view': Object.freeze([...VIEWS]),
    'view.resolution': Object.freeze([...RESOLUTIONS]),
    'view.timelineScaleRows': Object.freeze([1, 2, 3]),
    'view.textMode': Object.freeze([...TEXT_MODES]),
    'view.presentationStyle': Object.freeze(['standard', 'minimal', 'airy', 'contrast']),
    'view.timelineActivityRows': Object.freeze([...ACTIVITY_ROW_MODES]),
    'view.timelineMilestoneMode': Object.freeze([...MILESTONE_MODES]),
    'view.timelineWeekDays': Object.freeze([...WEEK_DAY_MODES]),
    'view.timelineDependencyArrows': Object.freeze([...DEPENDENCY_ARROW_MODES]),
    'view.flowDirection': Object.freeze([...FLOW_DIRECTIONS]),
    'view.flowArrows': Object.freeze(['curved', 'right-angle']),
    'view.flowShapes': Object.freeze(['capsules', 'flowchart']),
  });
  const MAX_DIMENSIONS = 20;
  const MAX_OPTIONS = 100;
  const MAX_ITEMS = 10000;
  const MAX_MILESTONES = 1000;
  const MAX_PERIOD_INDICATORS = 1000;
  const MAX_VIEWS = 99;

  function invalid(path, message) {
    throw new TypeError(`Invalid ${path}${message ? `: ${message}` : ''}`);
  }

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function requireRecord(value, path) {
    if (!isRecord(value)) invalid(path, 'expected an object');
    return value;
  }

  function requireArray(value, path, max) {
    if (!Array.isArray(value)) invalid(path, 'expected an array');
    if (max !== undefined && value.length > max) invalid(path, `at most ${max} entries`);
    return value;
  }

  function stringValue(value, path, maxLength, nonEmpty) {
    if (typeof value !== 'string') invalid(path, 'expected text');
    if (value.length > maxLength) invalid(path, `at most ${maxLength} characters`);
    if (nonEmpty && !value.trim()) invalid(path, 'must not be empty');
    return value;
  }

  function uuidValue(value, path) {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) invalid(path, 'expected a UUID');
    return value;
  }

  function colorValue(value, path) {
    if (typeof value !== 'string' || !COLOR_PATTERN.test(value))
      invalid(path, 'expected a six digit hexadecimal color');
    return value;
  }

  function parseDate(value) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return NaN;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(timestamp)) return NaN;
    const canonical = new Date(timestamp).toISOString().slice(0, 10);
    if (canonical !== value || value < MIN_DATE || value > MAX_DATE) return NaN;
    return timestamp;
  }

  function dateValue(value, path) {
    if (!Number.isFinite(parseDate(value))) invalid(path, 'expected a valid date');
    return value;
  }

  function dateTimestamp(value) {
    return parseDate(value);
  }

  function dayAfter(value) {
    return dateTimestamp(value) + DAY;
  }

  function ensureDateRange(start, end, path) {
    dateValue(start, `${path}.start`);
    dateValue(end, `${path}.end`);
    if (start > end) invalid(path, 'start must not be after end');
  }

  /**
   * The work days of a project: Monday to Friday, except days covered by a
   * vacation period. Dates are UTC midnight timestamps. `firstWorkDay` and
   * `lastWorkDay` may return a day after MAX_DATE, which callers reject.
   */
  function workCalendar(periodIndicators = []) {
    const limit = parseDate(MAX_DATE) + 400 * DAY;
    // Vacation periods merged into sorted, disjoint [start, end] ranges.
    const ranges = [];
    for (const [start, end] of periodIndicators
      .filter((period) => period && period.vacation !== false)
      .map((period) => [parseDate(period.start), parseDate(period.end)])
      .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && start <= end)
      .sort((left, right) => left[0] - right[0])) {
      const last = ranges[ranges.length - 1];
      if (last && start <= last[1] + DAY) last[1] = Math.max(last[1], end);
      else ranges.push([start, end]);
    }
    // The vacation range that holds `time`, or null.
    function vacation(time) {
      let low = 0;
      let high = ranges.length - 1;
      while (low <= high) {
        const middle = (low + high) >> 1;
        if (time < ranges[middle][0]) high = middle - 1;
        else if (time > ranges[middle][1]) low = middle + 1;
        else return ranges[middle];
      }
      return null;
    }
    const weekend = (time) => {
      const weekday = new Date(time).getUTCDay();
      return weekday === 0 || weekday === 6;
    };
    const isWorkDay = (time) => !weekend(time) && !vacation(time);
    function firstWorkDay(time) {
      let day = time;
      while (day <= limit) {
        const range = vacation(day);
        if (range) day = range[1] + DAY;
        else if (weekend(day)) day += DAY;
        else return day;
      }
      return day;
    }
    /** Work days from `start` through `end`, both included. */
    function countWorkDays(start, end) {
      let count = 0;
      for (let day = firstWorkDay(start); day <= end; day = firstWorkDay(day + DAY)) count += 1;
      return count;
    }
    /** The last day of `duration` work days counted from `start`. */
    function lastWorkDay(start, duration) {
      let day = firstWorkDay(start);
      for (let count = 1; count < duration && day <= limit; count += 1)
        day = firstWorkDay(day + DAY);
      return day;
    }
    /** An activity's length in work days, read from its dates: at least one. */
    const durationOf = (start, end) => Math.max(1, countWorkDays(start, end));
    return { isWorkDay, firstWorkDay, countWorkDays, lastWorkDay, durationOf };
  }

  function makeIdRegistry() {
    const ids = new Set();
    return {
      add(value, path) {
        const id = uuidValue(value, path);
        if (ids.has(id)) invalid(path, 'duplicate ID');
        ids.add(id);
        return id;
      },
      has(value) {
        return ids.has(value);
      },
    };
  }

  function randomUuidFromBytes(bytes) {
    if (!bytes || bytes.length < 16) throw new Error('Secure random bytes are unavailable');
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
      16,
      20,
    )}-${hex.slice(20)}`;
  }

  /** Return a cryptographically random RFC 4122 version 4 UUID. */
  function uuid() {
    const webCrypto = root && root.crypto;
    if (webCrypto && typeof webCrypto.randomUUID === 'function') {
      const value = webCrypto.randomUUID();
      if (typeof value === 'string' && UUID_PATTERN.test(value)) return value;
      throw new Error('crypto.randomUUID() returned an invalid UUID');
    }
    if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      webCrypto.getRandomValues(bytes);
      return randomUuidFromBytes(bytes);
    }

    // Node versions predating the global Web Crypto object still expose a
    // cryptographically secure source.  The guarded require keeps this path
    // out of browser script execution.
    if (typeof require === 'function') {
      try {
        const nodeCrypto = require('node:crypto');
        if (typeof nodeCrypto.randomUUID === 'function') {
          const value = nodeCrypto.randomUUID();
          if (typeof value === 'string' && UUID_PATTERN.test(value)) return value;
        }
        if (typeof nodeCrypto.randomBytes === 'function')
          return randomUuidFromBytes(nodeCrypto.randomBytes(16));
      } catch (_error) {
        // Continue to the explicit failure below.  Browser bundlers may
        // expose a nonfunctional `require`, which should not hide the real
        // reason UUID creation failed.
      }
    }
    throw new Error('No cryptographically secure UUID source is available');
  }

  function parseJsonInput(value, path) {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch (_error) {
      invalid(path, 'invalid JSON');
    }
  }

  function contextFrom(value) {
    if (value === undefined || value === null) return {};
    if (typeof value === 'string') return { projectId: uuidValue(value, 'projectId') };
    if (!isRecord(value)) invalid('context', 'expected a project, manifest, or project ID');

    const source = isRecord(value.manifest) ? value.manifest : value;
    const context = {};
    if (hasOwn(source, 'projectId')) context.projectId = uuidValue(source.projectId, 'projectId');
    if (Array.isArray(source.dimensions)) {
      context.dimensions = source.dimensions;
      context.dimensionIds = new Set(source.dimensions.map((dimension) => dimension.id));
      context.optionIds = new Set(
        source.dimensions.flatMap((dimension) =>
          Array.isArray(dimension.options) ? dimension.options.map((option) => option.id) : [],
        ),
      );
      context.optionByDimension = new Map(
        source.dimensions.map((dimension) => [
          dimension.id,
          new Set(
            Array.isArray(dimension.options) ? dimension.options.map((option) => option.id) : [],
          ),
        ]),
      );
    }
    if (Number.isInteger(source.year)) context.year = source.year;
    return context;
  }

  function ownerValue(value, context, path) {
    const owner = uuidValue(value, path);
    if (context.projectId !== undefined && owner !== context.projectId)
      invalid(path, 'must match manifest.projectId');
    return owner;
  }

  function normalizeDimensions(value, registry, path = 'manifest.dimensions') {
    const dimensions = requireArray(value, path, MAX_DIMENSIONS);
    return dimensions.map((dimension, dimensionIndex) => {
      const dimensionPath = `${path}[${dimensionIndex}]`;
      const source = requireRecord(dimension, dimensionPath);
      const id = registry.add(source.id, `${dimensionPath}.id`);
      const name = stringValue(source.name, `${dimensionPath}.name`, 100, false);
      const options = requireArray(source.options, `${dimensionPath}.options`, MAX_OPTIONS).map(
        (option, optionIndex) => {
          const optionPath = `${dimensionPath}.options[${optionIndex}]`;
          const optionSource = requireRecord(option, optionPath);
          return {
            id: registry.add(optionSource.id, `${optionPath}.id`),
            name: stringValue(optionSource.name, `${optionPath}.name`, 100, false),
            color: colorValue(optionSource.color, `${optionPath}.color`),
          };
        },
      );
      return { id, name, options };
    });
  }

  function normalizeManifest(value, registry = makeIdRegistry()) {
    const source = requireRecord(value, 'manifest');
    if (source.formatVersion !== 1) invalid('manifest.formatVersion', 'must be 1');
    const projectId = uuidValue(source.projectId, 'manifest.projectId');
    if (registry.has(projectId)) invalid('manifest.projectId', 'duplicate ID');
    registry.add(projectId, 'manifest.projectId');
    const name = stringValue(source.name, 'manifest.name', 100, true);
    const description = stringValue(source.description, 'manifest.description', 500, false);
    if (!Number.isInteger(source.year) || source.year < 1900 || source.year > 2200)
      invalid('manifest.year', 'must be an integer from 1900 through 2200');
    const shareLinkCreatedAt = source.shareLinkCreatedAt;
    if (
      shareLinkCreatedAt !== undefined &&
      (typeof shareLinkCreatedAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(shareLinkCreatedAt) ||
        !Number.isFinite(Date.parse(shareLinkCreatedAt)) ||
        new Date(shareLinkCreatedAt).toISOString().replace('.000Z', 'Z') !== shareLinkCreatedAt)
    )
      invalid('manifest.shareLinkCreatedAt', 'must be a UTC ISO 8601 timestamp with whole seconds');
    const dimensions = normalizeDimensions(source.dimensions, registry);
    const schedule = source.schedule === undefined ? 'calendar-days' : source.schedule;
    if (!SCHEDULES.has(schedule))
      invalid('manifest.schedule', 'must be calendar-days or work-days');
    return {
      projectId,
      formatVersion: 1,
      name,
      description,
      dimensions,
      year: source.year,
      schedule,
      ...(shareLinkCreatedAt === undefined ? {} : { shareLinkCreatedAt }),
    };
  }

  function normalizeValues(value, context, path) {
    if (value === undefined || value === null) return {};
    if (!isRecord(value)) invalid(path, 'expected an object');
    const values = {};
    if (context.optionByDimension) {
      for (const [dimensionId, optionIds] of context.optionByDimension) {
        if (!hasOwn(value, dimensionId)) continue;
        const optionId = value[dimensionId];
        if (optionId === '') {
          values[dimensionId] = '';
          continue;
        }
        if (typeof optionId !== 'string' || !optionIds.has(optionId))
          invalid(
            `${path}.${dimensionId}`,
            'must reference an option in its dimension or be empty',
          );
        values[dimensionId] = optionId;
      }
      return values;
    }

    // Section serializers can be used without a manifest.  Keep only the
    // shape that a canonical values map can have until aggregate validation
    // supplies the dimension and option dictionaries.
    for (const [dimensionId, optionId] of Object.entries(value)) {
      if (!UUID_PATTERN.test(dimensionId)) continue;
      if (optionId !== '' && (typeof optionId !== 'string' || !UUID_PATTERN.test(optionId)))
        invalid(`${path}.${dimensionId}`, 'must be an option UUID or empty');
      values[dimensionId] = optionId;
    }
    return values;
  }

  function normalizeDependencies(value, path) {
    if (value === undefined) return [];
    const dependencies = requireArray(value, path);
    const seen = new Set();
    return dependencies.map((dependency, index) => {
      const dependencyPath = `${path}[${index}]`;
      const id = uuidValue(dependency, dependencyPath);
      if (seen.has(id)) invalid(dependencyPath, 'duplicate dependency');
      seen.add(id);
      return id;
    });
  }

  // An activity waits for other activities and for fixed milestones,
  // events on a set date that wait for nothing themselves.
  function validateItemDependencies(items, path = 'items', milestones = []) {
    const byId = new Map(items.map((item) => [item.id, item]));
    const fixed = new Map(
      milestones.filter((milestone) => milestone.fixed).map((point) => [point.id, point]),
    );
    const visiting = new Set();
    const visited = new Set();
    function visit(item) {
      if (visited.has(item.id)) return;
      if (visiting.has(item.id)) invalid(`${path}.${item.id}.dependsOn`, 'dependency cycle');
      visiting.add(item.id);
      for (const dependency of item.dependsOn) {
        if (fixed.has(dependency)) continue;
        if (!byId.has(dependency))
          invalid(`${path}.${item.id}.dependsOn`, `unknown activity ${dependency}`);
        visit(byId.get(dependency));
      }
      visiting.delete(item.id);
      visited.add(item.id);
    }
    for (const item of items) visit(item);

    // Tidigar dependencies are finish-to-start with one whole day between
    // records; a fixed milestone lets work start on its own date.
    // Deserialization validates this contract and never moves user dates as
    // a side effect.
    for (const item of items) {
      for (const dependency of item.dependsOn) {
        const point = fixed.get(dependency);
        if (point) {
          if (item.start < point.date)
            invalid(`${path}.${item.id}.start`, `must not be before fixed milestone ${dependency}`);
          continue;
        }
        const parent = byId.get(dependency);
        if (dateTimestamp(item.start) < dayAfter(parent.end))
          invalid(
            `${path}.${item.id}.start`,
            `must be at least one day after dependency ${dependency} ends`,
          );
      }
    }
  }

  function normalizeItems(
    value,
    contextInput,
    registry = makeIdRegistry(),
    deferDependencies = false,
  ) {
    const context = contextFrom(contextInput);
    const items = requireArray(value, 'items', MAX_ITEMS).map((item, index) => {
      const path = `items[${index}]`;
      const source = requireRecord(item, path);
      const id = registry.add(source.id, `${path}.id`);
      const projectId = ownerValue(source.projectId, context, `${path}.projectId`);
      const title = stringValue(source.title, `${path}.title`, 180, false);
      const description = stringValue(source.description, `${path}.description`, 12000, false);
      const progress = source.progress === undefined ? 0 : source.progress;
      if (!PROGRESS_VALUES.has(progress))
        invalid(`${path}.progress`, 'must be one of 0, 25, 50, 75, or 100');
      const start = dateValue(source.start, `${path}.start`);
      const end = dateValue(source.end, `${path}.end`);
      if (start > end) invalid(path, 'start must not be after end');
      const values = normalizeValues(source.values, context, `${path}.values`);
      const dependsOn = normalizeDependencies(source.dependsOn, `${path}.dependsOn`);
      return { id, projectId, title, description, progress, start, end, values, dependsOn };
    });
    // A whole project checks dependencies once its milestones are known.
    if (!deferDependencies) validateItemDependencies(items);
    return items;
  }

  function normalizeDimensionReference(value, validIds, path) {
    if (value === undefined) return '';
    if (value === '') return '';
    if (typeof value !== 'string' || !validIds.has(value))
      invalid(path, 'must reference a manifest dimension or be empty');
    return value;
  }

  function normalizeColorOverrides(value, optionIds, path) {
    if (value === undefined || value === null) return {};
    if (!isRecord(value)) invalid(path, 'expected an object');
    const result = {};
    for (const [optionId, color] of Object.entries(value)) {
      if (Object.keys(result).length >= 100) break;
      if (!optionIds.has(optionId)) continue;
      if (!COLOR_PATTERN.test(color)) continue;
      result[optionId] = color;
    }
    return result;
  }

  function normalizeFilters(value, context, path) {
    if (value === undefined || value === null) return {};
    if (!isRecord(value)) invalid(path, 'expected an object');
    const filters = {};
    if (!context.optionByDimension) return filters;
    for (const [dimensionId, optionId] of Object.entries(value)) {
      const options = context.optionByDimension.get(dimensionId);
      if (!options) continue;
      if (optionId !== '' && !options.has(optionId)) continue;
      filters[dimensionId] = optionId;
    }
    return filters;
  }

  function normalizeColumns(value, fallback, validKeys, path) {
    if (value === undefined) return fallback.slice();
    if (!Array.isArray(value)) return fallback.slice();
    const seen = new Set();
    const columns = [];
    for (const key of value) {
      if (typeof key !== 'string' || !validKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      columns.push(key);
    }
    return columns;
  }

  function normalizeViews(value, contextInput, registry = makeIdRegistry()) {
    const context = contextFrom(contextInput);
    const views = requireArray(value, 'sharedViews', MAX_VIEWS);
    const dimensions = context.dimensionIds || new Set();
    const optionIds = context.optionIds || new Set();
    const year = Number.isInteger(context.year) ? context.year : new Date().getFullYear();
    const defaultStart = `${year}-01-01`;
    const defaultEnd = `${year}-12-31`;
    const columnKeys = new Set(['title', 'start', 'end', ...dimensions]);
    return views.map((view, index) => {
      const path = `sharedViews[${index}]`;
      const source = requireRecord(view, path);
      const id = registry.add(source.id, `${path}.id`);
      const projectId = ownerValue(source.projectId, context, `${path}.projectId`);
      const name = stringValue(source.name, `${path}.name`, 100, true);
      const mode = source.view === undefined ? 'grid' : source.view;
      if (!VIEWS.has(mode)) invalid(`${path}.view`, 'must be grid, timeline, list, or flow');
      const row = normalizeDimensionReference(source.row, dimensions, `${path}.row`);
      const col = normalizeDimensionReference(source.col, dimensions, `${path}.col`);
      const color = normalizeDimensionReference(source.color, dimensions, `${path}.color`);
      const flowGroup = normalizeDimensionReference(
        source.flowGroup,
        dimensions,
        `${path}.flowGroup`,
      );
      const group = normalizeDimensionReference(source.group, dimensions, `${path}.group`);
      const resolution = source.resolution === undefined ? 'month' : source.resolution;
      if (!RESOLUTIONS.has(resolution)) invalid(`${path}.resolution`, 'has an unsupported value');
      const timelineScaleRows =
        source.timelineScaleRows === undefined ? 3 : source.timelineScaleRows;
      if (![1, 2, 3].includes(timelineScaleRows))
        invalid(`${path}.timelineScaleRows`, 'must be 1, 2, or 3');
      const textMode =
        source.textMode === undefined ? 'beside' : currentViewValue('textMode', source.textMode);
      if (!TEXT_MODES.has(textMode)) invalid(`${path}.textMode`, 'has an unsupported value');
      const timelineActivityRows =
        source.timelineActivityRows === undefined
          ? source.hideTimelineLabels === false
            ? 'single-label'
            : 'single'
          : source.timelineActivityRows;
      if (!ACTIVITY_ROW_MODES.has(timelineActivityRows))
        invalid(`${path}.timelineActivityRows`, 'has an unsupported value');
      const hideTimelineLabels = timelineActivityRows === 'single';
      const timelineMilestoneMode =
        source.timelineMilestoneMode === undefined
          ? 'label'
          : currentViewValue('timelineMilestoneMode', source.timelineMilestoneMode);
      if (!MILESTONE_MODES.has(timelineMilestoneMode))
        invalid(`${path}.timelineMilestoneMode`, 'has an unsupported value');
      const timelineWeekDays =
        source.timelineWeekDays === undefined ? 'work' : source.timelineWeekDays;
      if (!WEEK_DAY_MODES.has(timelineWeekDays))
        invalid(`${path}.timelineWeekDays`, 'has an unsupported value');
      const timelineDependencyArrows =
        source.timelineDependencyArrows === undefined
          ? 'grouped'
          : currentViewValue('timelineDependencyArrows', source.timelineDependencyArrows);
      if (!DEPENDENCY_ARROW_MODES.has(timelineDependencyArrows))
        invalid(`${path}.timelineDependencyArrows`, 'has an unsupported value');
      const presentationStyle =
        source.presentationStyle === undefined ? 'standard' : source.presentationStyle;
      if (!ENUM_VALUES['view.presentationStyle'].includes(presentationStyle))
        invalid(`${path}.presentationStyle`, 'has an unsupported value');
      const flowDirection = source.flowDirection === undefined ? 'auto' : source.flowDirection;
      if (!FLOW_DIRECTIONS.has(flowDirection))
        invalid(`${path}.flowDirection`, 'has an unsupported value');
      const flowArrows = source.flowArrows === undefined ? 'curved' : source.flowArrows;
      const flowShapes = source.flowShapes === undefined ? 'capsules' : source.flowShapes;
      for (const [field, value] of [
        ['flowArrows', flowArrows],
        ['flowShapes', flowShapes],
      ])
        if (!ENUM_VALUES[`view.${field}`].includes(value))
          invalid(`${path}.${field}`, 'has an unsupported value');
      const timelineStart =
        source.timelineStart === undefined ? defaultStart : source.timelineStart;
      const timelineEnd = source.timelineEnd === undefined ? defaultEnd : source.timelineEnd;
      ensureDateRange(timelineStart, timelineEnd, path);
      const listFallback = ['title', 'start', 'end', ...dimensions];
      return {
        id,
        projectId,
        name,
        view: mode,
        row,
        col,
        color,
        presentationStyle,
        colorOverrides: normalizeColorOverrides(
          source.colorOverrides,
          optionIds,
          `${path}.colorOverrides`,
        ),
        group,
        resolution,
        timelineScaleRows,
        timelineShowWeeks: booleanValue(
          source.timelineShowWeeks,
          `${path}.timelineShowWeeks`,
          true,
        ),
        timelineShowQuarters: booleanValue(
          source.timelineShowQuarters,
          `${path}.timelineShowQuarters`,
          true,
        ),
        timelineShowToday: booleanValue(
          source.timelineShowToday,
          `${path}.timelineShowToday`,
          false,
        ),
        timelineShowPeriodNames: booleanValue(
          source.timelineShowPeriodNames,
          `${path}.timelineShowPeriodNames`,
          false,
        ),
        textMode,
        filters: normalizeFilters(source.filters, context, `${path}.filters`),
        query:
          source.query === undefined ? '' : stringValue(source.query, `${path}.query`, 200, false),
        hideEmptyRows: booleanValue(source.hideEmptyRows, `${path}.hideEmptyRows`, true),
        hideEmptyColumns: booleanValue(source.hideEmptyColumns, `${path}.hideEmptyColumns`, true),
        hideEmptyTimelineGroups: booleanValue(
          source.hideEmptyTimelineGroups,
          `${path}.hideEmptyTimelineGroups`,
          true,
        ),
        hideUnconnectedActivities: booleanValue(
          source.hideUnconnectedActivities,
          `${path}.hideUnconnectedActivities`,
          false,
        ),
        flowGroupMilestones: booleanValue(
          source.flowGroupMilestones,
          `${path}.flowGroupMilestones`,
          false,
        ),
        hideEmptyFlowGroups: booleanValue(
          source.hideEmptyFlowGroups,
          `${path}.hideEmptyFlowGroups`,
          false,
        ),
        timelineActivityRows,
        hideTimelineLabels,
        timelineMilestoneMode,
        timelineWeekDays,
        timelineDependencyArrows,
        flowDirection,
        flowArrows,
        flowShapes,
        flowGroup,
        timelineStart,
        timelineEnd,
        listColumns: normalizeColumns(
          source.listColumns,
          listFallback,
          columnKeys,
          `${path}.listColumns`,
        ),
        listColumnOrder: normalizeColumns(
          source.listColumnOrder,
          listFallback,
          columnKeys,
          `${path}.listColumnOrder`,
        ),
      };
    });
  }

  function booleanValue(value, path, fallback) {
    if (value === undefined) return fallback;
    if (typeof value !== 'boolean') invalid(path, 'expected a boolean');
    return value;
  }

  function normalizeMilestones(value, contextInput, itemIds, registry = makeIdRegistry()) {
    const context = contextFrom(contextInput);
    const milestones = requireArray(value, 'milestones', MAX_MILESTONES);
    const byItemId = itemIds || new Set();
    return milestones.map((milestone, index) => {
      const path = `milestones[${index}]`;
      const source = requireRecord(milestone, path);
      const id = registry.add(source.id, `${path}.id`);
      const projectId = ownerValue(source.projectId, context, `${path}.projectId`);
      const title = stringValue(source.title, `${path}.title`, 180, true);
      const date = dateValue(source.date, `${path}.date`);
      const dependsOn = normalizeDependencies(source.dependsOn, `${path}.dependsOn`);
      const fixed = booleanValue(source.fixed, `${path}.fixed`, false);
      // A fixed milestone is an event on a set date: work waits for
      // it, and it waits for nothing.
      if (fixed && dependsOn.length)
        invalid(`${path}.dependsOn`, 'must be empty for a fixed milestone');
      for (const dependency of dependsOn) {
        if (!byItemId.has(dependency))
          invalid(`${path}.dependsOn`, `unknown activity ${dependency}`);
      }
      return { id, projectId, title, date, dependsOn, fixed };
    });
  }

  function normalizePeriodIndicators(value, contextInput, registry = makeIdRegistry()) {
    const context = contextFrom(contextInput);
    const indicators = requireArray(value, 'periodIndicators', MAX_PERIOD_INDICATORS);
    return indicators.map((indicator, index) => {
      const path = `periodIndicators[${index}]`;
      const source = requireRecord(indicator, path);
      const id = registry.add(source.id, `${path}.id`);
      const projectId = ownerValue(source.projectId, context, `${path}.projectId`);
      const title = stringValue(source.title, `${path}.title`, 180, true);
      const start = dateValue(source.start, `${path}.start`);
      const end = dateValue(source.end, `${path}.end`);
      if (start > end) invalid(path, 'start must not be after end');
      const color = colorValue(source.color, `${path}.color`).toLowerCase();
      const vacation = booleanValue(source.vacation, `${path}.vacation`, true);
      return { id, projectId, title, start, end, color, vacation };
    });
  }

  function validateMilestoneDates(milestones, items) {
    const byId = new Map(items.map((item) => [item.id, item]));
    for (let index = 0; index < milestones.length; index += 1) {
      const milestone = milestones[index];
      for (const dependency of milestone.dependsOn) {
        const parent = byId.get(dependency);
        if (!parent) invalid(`milestones[${index}].dependsOn`, `unknown activity ${dependency}`);
        if (dateTimestamp(milestone.date) < dayAfter(parent.end))
          invalid(
            `milestones[${index}].date`,
            `must be at least one day after dependency ${dependency} ends`,
          );
      }
    }
  }

  /** Validate and deep-normalize a complete canonical project. */
  function normalizeProject(value) {
    const source = requireRecord(value, 'project');
    const registry = makeIdRegistry();
    const manifest = normalizeManifest(source.manifest, registry);
    const items = normalizeItems(source.items, manifest, registry, true);
    const itemIds = new Set(items.map((item) => item.id));
    const sharedViews = normalizeViews(source.sharedViews, manifest, registry);
    const milestones = normalizeMilestones(source.milestones, manifest, itemIds, registry);
    const periodIndicators = normalizePeriodIndicators(source.periodIndicators, manifest, registry);
    validateItemDependencies(items, 'items', milestones);
    validateMilestoneDates(milestones, items);
    return { manifest, items, sharedViews, milestones, periodIndicators };
  }

  /**
   * Return a normalized copy of a project under a new identity, for example
   * the conflict copy that keeps another device's version of a document
   * (ADR-020). Every record's `projectId` follows the manifest; record IDs are
   * kept, since they only need to be unique within one project.
   */
  function copyAsNewProject(value, options) {
    const source = normalizeProject(value);
    const settings = requireRecord(options, 'options');
    const projectId = uuidValue(settings.projectId, 'options.projectId');
    if (projectId === source.manifest.projectId)
      invalid('options.projectId', 'must differ from the source');
    const name = stringValue(settings.name, 'options.name', 100, true);
    const own = (records) => records.map((record) => ({ ...record, projectId }));
    return normalizeProject({
      manifest: { ...source.manifest, projectId, name },
      items: own(source.items),
      sharedViews: own(source.sharedViews),
      milestones: own(source.milestones),
      periodIndicators: own(source.periodIndicators),
    });
  }

  /** JSON encode a normalized complete project. */
  function serializeProject(project) {
    return JSON.stringify(normalizeProject(project));
  }

  /** Decode and normalize a JSON string or object containing a project. */
  function deserializeProject(value) {
    return normalizeProject(parseJsonInput(value, 'project'));
  }

  /** JSON encode/decode the manifest section using its explicit whitelist. */
  function serializeManifest(manifest) {
    return JSON.stringify(normalizeManifest(manifest));
  }

  function deserializeManifest(value) {
    return normalizeManifest(parseJsonInput(value, 'manifest'));
  }

  function sectionArguments(value, contextInput, sectionName) {
    if (contextInput === undefined && isRecord(value) && Array.isArray(value[sectionName]))
      return { section: value[sectionName], context: value };
    return { section: value, context: contextInput };
  }

  /** JSON encode/decode an items section.  A project or manifest context is optional. */
  function serializeItems(items, contextInput) {
    const args = sectionArguments(items, contextInput, 'items');
    return JSON.stringify(normalizeItems(args.section, args.context));
  }

  function deserializeItems(value, contextInput) {
    const parsed = parseJsonInput(value, 'items');
    const args = sectionArguments(parsed, contextInput, 'items');
    return normalizeItems(args.section, args.context);
  }

  /** JSON encode/decode shared presentation views.  Empty view arrays are valid. */
  function serializeViews(views, contextInput) {
    const args = sectionArguments(views, contextInput, 'sharedViews');
    return JSON.stringify(normalizeViews(args.section, args.context));
  }

  function deserializeViews(value, contextInput) {
    const parsed = parseJsonInput(value, 'sharedViews');
    const args = sectionArguments(parsed, contextInput, 'sharedViews');
    return normalizeViews(args.section, args.context);
  }

  const CALENDAR_METADATA_FORMAT = 'tidigar-calendar-notes';
  const CALENDAR_METADATA_VERSION = 1;

  function exactKeys(value, expected, path) {
    const actual = Object.keys(value).sort();
    const keys = expected.slice().sort();
    if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index]))
      invalid(path, 'contains unsupported fields');
  }

  function normalizeOrder(value, path) {
    const order = requireArray(value, path);
    const seen = new Set();
    return order.map((id, index) => {
      const normalized = uuidValue(id, `${path}[${index}]`);
      if (seen.has(normalized)) invalid(path, 'contains duplicate IDs');
      seen.add(normalized);
      return normalized;
    });
  }

  function serializeCalendarMetadata(project, section, viewId) {
    const normalized = normalizeProject(project);
    let payload;
    if (section === 'manifest') {
      payload = {
        manifest: JSON.parse(serializeManifest(normalized.manifest)),
        itemOrder: normalized.items.map((item) => item.id),
        milestoneOrder: normalized.milestones.map((milestone) => milestone.id),
        periodOrder: normalized.periodIndicators.map((indicator) => indicator.id),
        viewOrder: normalized.sharedViews.map((view) => view.id),
      };
    } else if (section === 'view') {
      const matches = viewId
        ? normalized.sharedViews.filter((view) => view.id === viewId)
        : normalized.sharedViews;
      if (matches.length !== 1) invalid('viewId', 'must identify exactly one shared view');
      payload = { view: JSON.parse(serializeViews(matches, normalized.manifest))[0] };
    } else {
      invalid('section', 'must be manifest or view');
    }
    return JSON.stringify({
      format: CALENDAR_METADATA_FORMAT,
      version: CALENDAR_METADATA_VERSION,
      section,
      payload,
    });
  }

  function deserializeCalendarMetadata(value, section, contextInput) {
    const source = requireRecord(parseJsonInput(value, 'calendarMetadata'), 'calendarMetadata');
    exactKeys(source, ['format', 'version', 'section', 'payload'], 'calendarMetadata');
    if (source.format !== CALENDAR_METADATA_FORMAT)
      invalid('calendarMetadata.format', 'unsupported');
    if (source.version !== CALENDAR_METADATA_VERSION)
      invalid('calendarMetadata.version', 'unsupported');
    if (source.section !== section) invalid('calendarMetadata.section', 'unexpected section');
    const payload = requireRecord(source.payload, 'calendarMetadata.payload');
    if (section === 'manifest') {
      exactKeys(
        payload,
        ['manifest', 'itemOrder', 'milestoneOrder', 'periodOrder', 'viewOrder'],
        'calendarMetadata.payload',
      );
      const manifest = deserializeManifest(payload.manifest);
      const itemOrder = normalizeOrder(payload.itemOrder, 'calendarMetadata.itemOrder');
      const milestoneOrder = normalizeOrder(
        payload.milestoneOrder,
        'calendarMetadata.milestoneOrder',
      );
      const periodOrder = normalizeOrder(payload.periodOrder, 'calendarMetadata.periodOrder');
      const viewOrder = normalizeOrder(payload.viewOrder, 'calendarMetadata.viewOrder');
      return { manifest, itemOrder, milestoneOrder, periodOrder, viewOrder };
    }
    if (section === 'view') {
      exactKeys(payload, ['view'], 'calendarMetadata.payload');
      const views = deserializeViews(JSON.stringify([payload.view]), contextInput);
      return { view: views[0] };
    }
    invalid('section', 'must be manifest or view');
  }

  /** Encode a single project wrapper used by downloaded Tidigar files. */
  function encodeFile(project) {
    return { format: 'tidigar-project', project: normalizeProject(project) };
  }

  /** Decode a single project wrapper and return its canonical project. */
  function decodeFile(value) {
    const source = requireRecord(parseJsonInput(value, 'file'), 'file');
    if (source.format !== 'tidigar-project') invalid('file.format', 'must be tidigar-project');
    return normalizeProject(source.project);
  }

  /** Encode a collection of canonical projects as a backup wrapper. */
  function encodeBackup(projects) {
    if (!Array.isArray(projects)) invalid('projects', 'expected an array');
    return {
      format: 'tidigar-backup',
      projects: projects.map((project) => normalizeProject(project)),
    };
  }

  /** Decode a backup wrapper and return its canonical project array. */
  function decodeBackup(value) {
    const source = requireRecord(parseJsonInput(value, 'backup'), 'backup');
    if (source.format !== 'tidigar-backup') invalid('backup.format', 'must be tidigar-backup');
    if (!Array.isArray(source.projects)) invalid('backup.projects', 'expected an array');
    return source.projects.map((project) => normalizeProject(project));
  }

  function stringify(value, space = 2) {
    return JSON.stringify(value, null, space);
  }

  function parse(value) {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch (_error) {
      invalid('JSON', 'invalid JSON');
    }
  }

  const OMIT = Symbol('omit');
  const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  function sanitizeJson(value, seen, path, inArray) {
    if (value === null) return null;
    switch (typeof value) {
      case 'string':
      case 'boolean':
        return value;
      case 'number':
        return Number.isFinite(value) ? value : null;
      case 'undefined':
      case 'function':
      case 'symbol':
      case 'bigint':
        return inArray ? null : OMIT;
      case 'object':
        break;
      default:
        return inArray ? null : OMIT;
    }
    if (seen.has(value)) invalid(path, 'contains a circular reference');
    seen.add(value);
    let result;
    if (Array.isArray(value)) {
      result = value.map((entry, index) => {
        const sanitized = sanitizeJson(entry, seen, `${path}[${index}]`, true);
        return sanitized === OMIT ? null : sanitized;
      });
    } else if (value instanceof Date) {
      result = Number.isFinite(value.getTime()) ? value.toISOString() : null;
    } else {
      result = {};
      for (const [key, entry] of Object.entries(value)) {
        if (UNSAFE_KEYS.has(key)) continue;
        const sanitized = sanitizeJson(entry, seen, `${path}.${key}`, false);
        if (sanitized !== OMIT) result[key] = sanitized;
      }
    }
    seen.delete(value);
    return result;
  }

  /** Sanitize and JSON encode personal, device-local view state. */
  function serializeViewState(value) {
    const sanitized = sanitizeJson(value, new Set(), 'viewState', false);
    return JSON.stringify(sanitized === OMIT ? null : sanitized);
  }

  /** Decode and sanitize personal view state without applying project rules. */
  function deserializeViewState(value) {
    const parsed = parseJsonInput(value, 'viewState');
    const sanitized = sanitizeJson(parsed, new Set(), 'viewState', false);
    return sanitized === OMIT ? null : sanitized;
  }

  return {
    uuid,
    maxViews: MAX_VIEWS,
    enumValues: ENUM_VALUES,
    renamedViewValues: RENAMED_VIEW_VALUES,
    workCalendar,
    normalizeProject,
    copyAsNewProject,
    normalizeManifest,
    normalizeItems,
    normalizeViews,
    serializeProject,
    deserializeProject,
    serializeManifest,
    deserializeManifest,
    serializeItems,
    deserializeItems,
    serializeViews,
    deserializeViews,
    serializeCalendarMetadata,
    deserializeCalendarMetadata,
    encodeFile,
    decodeFile,
    encodeBackup,
    decodeBackup,
    serializeViewState,
    deserializeViewState,
    stringify,
    parse,
  };
});
})(scope);
(function (globalThis) {
/* Share links: a whole project and its initial view packed into a URL
   fragment small enough to share anywhere (ADR-076). IDs become positions in
   the link, and opening one yields a fresh copy with new IDs, unless the
   caller passes an earlier copy whose IDs to keep. */
(function installTidigarShareLink(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.tidigarShareLink = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTidigarShareLink() {
  'use strict';

  const VERSION = 1;
  const PREFIX = `s=${VERSION}.`;
  // The whole link stays within 2,000 characters for any Tidigar origin and
  // path of up to 100 characters.
  const MAX_FRAGMENT_LENGTH = 1900;
  const MAX_INFLATED_BYTES = 262144;
  const DAY = 86400000;
  const OMITTED_VIEW_FIELDS = new Set(['id', 'projectId', 'name', 'hideTimelineLabels']);
  const DIMENSION_FIELDS = new Set(['row', 'col', 'color', 'group', 'flowGroup']);
  const COLUMN_FIELDS = new Set(['listColumns', 'listColumnOrder']);

  class ShareLinkError extends Error {
    constructor(code, message, details = {}) {
      super(message);
      this.name = 'ShareLinkError';
      this.code = code;
      Object.assign(this, details);
    }
  }

  function fail(code, message, details) {
    throw new ShareLinkError(code, message, details);
  }

  function dayNumber(date) {
    return Date.parse(`${date}T00:00:00Z`) / DAY;
  }

  function trimTail(values, defaults) {
    const result = values.slice();
    while (
      result.length &&
      defaults[result.length - 1] !== null &&
      JSON.stringify(result[result.length - 1]) === JSON.stringify(defaults[result.length - 1])
    )
      result.pop();
    return result;
  }

  function trimZeros(values) {
    const result = values.slice();
    while (result.length && result[result.length - 1] === 0) result.pop();
    return result;
  }

  function toBase64Url(bytes) {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(text) {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  async function readAll(stream, limit) {
    const reader = stream.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        fail('invalid', 'The share link expands beyond its size limit.');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }

  /* Synchronous decoding without web APIs, for a start that cannot wait and
     for JavaScript engines without streams or atob (ADR-162). */
  function base64UrlBytes(text) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const values = new Map([...alphabet].map((character, index) => [character, index]));
    const bytes = [];
    let buffer = 0,
      bits = 0;
    for (const character of text) {
      buffer = (buffer << 6) | values.get(character);
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 255);
      }
    }
    return Uint8Array.from(bytes);
  }

  // Raw DEFLATE (RFC 1951): stored, fixed and dynamic Huffman blocks.
  function inflateRaw(input, limit) {
    const output = [];
    let position = 0,
      bit = 0;
    const read = (count) => {
      let value = 0;
      for (let index = 0; index < count; index += 1) {
        if (position >= input.length) fail('corrupt', 'The share link is damaged.');
        value |= ((input[position] >> bit) & 1) << index;
        if (++bit === 8) {
          bit = 0;
          position += 1;
        }
      }
      return value;
    };
    const table = (lengths) => {
      const counts = new Array(16).fill(0),
        offsets = new Array(16).fill(0),
        symbols = [];
      for (const length of lengths) counts[length] += 1;
      counts[0] = 0;
      for (let length = 1; length < 16; length += 1)
        offsets[length] = offsets[length - 1] + counts[length - 1];
      lengths.forEach((length, symbol) => {
        if (length) symbols[offsets[length]++] = symbol;
      });
      return { counts, symbols };
    };
    const decode = ({ counts, symbols }) => {
      let code = 0,
        first = 0,
        index = 0;
      for (let length = 1; length < 16; length += 1) {
        code |= read(1);
        const count = counts[length];
        if (code - count < first) return symbols[index + (code - first)];
        index += count;
        first = (first + count) << 1;
        code <<= 1;
      }
      fail('corrupt', 'The share link is damaged.');
    };
    const lengthBase = [
      3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
      163, 195, 227, 258,
    ];
    const lengthExtra = [
      0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
    ];
    const distanceBase = [
      1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537,
      2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
    ];
    const distanceExtra = [
      0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
      13,
    ];
    const push = (byte) => {
      if (output.length >= limit) fail('invalid', 'The share link expands beyond its size limit.');
      output.push(byte);
    };
    let last = 0;
    while (!last) {
      last = read(1);
      const type = read(2);
      if (type === 0) {
        if (bit) {
          bit = 0;
          position += 1;
        }
        const length = input[position] | (input[position + 1] << 8);
        position += 4;
        if (position + length > input.length) fail('corrupt', 'The share link is damaged.');
        for (let index = 0; index < length; index += 1) push(input[position + index]);
        position += length;
        continue;
      }
      if (type === 3) fail('corrupt', 'The share link is damaged.');
      let literals, distances;
      if (type === 1) {
        literals = table([
          ...new Array(144).fill(8),
          ...new Array(112).fill(9),
          ...new Array(24).fill(7),
          ...new Array(8).fill(8),
        ]);
        distances = table(new Array(30).fill(5));
      } else {
        const literalCount = read(5) + 257,
          distanceCount = read(5) + 1,
          codeCount = read(4) + 4;
        const order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
        const codeLengths = new Array(19).fill(0);
        for (let index = 0; index < codeCount; index += 1) codeLengths[order[index]] = read(3);
        const codes = table(codeLengths);
        const lengths = [];
        while (lengths.length < literalCount + distanceCount) {
          const symbol = decode(codes);
          if (symbol < 16) lengths.push(symbol);
          else if (symbol === 16) {
            if (!lengths.length) fail('corrupt', 'The share link is damaged.');
            const previous = lengths[lengths.length - 1];
            for (let repeat = 3 + read(2); repeat > 0; repeat -= 1) lengths.push(previous);
          } else
            for (let repeat = symbol === 17 ? 3 + read(3) : 11 + read(7); repeat > 0; repeat -= 1)
              lengths.push(0);
        }
        literals = table(lengths.slice(0, literalCount));
        distances = table(lengths.slice(literalCount, literalCount + distanceCount));
      }
      for (;;) {
        const symbol = decode(literals);
        if (symbol < 256) push(symbol);
        else if (symbol === 256) break;
        else {
          const lengthIndex = symbol - 257;
          if (lengthIndex >= lengthBase.length) fail('corrupt', 'The share link is damaged.');
          const length = lengthBase[lengthIndex] + read(lengthExtra[lengthIndex]);
          const distanceIndex = decode(distances);
          if (distanceIndex >= distanceBase.length) fail('corrupt', 'The share link is damaged.');
          const distance = distanceBase[distanceIndex] + read(distanceExtra[distanceIndex]);
          if (distance > output.length) fail('corrupt', 'The share link is damaged.');
          for (let index = 0; index < length; index += 1) push(output[output.length - distance]);
        }
      }
    }
    return output;
  }

  function utf8Text(bytes) {
    let text = '';
    for (let index = 0; index < bytes.length;) {
      const byte = bytes[index++];
      let code;
      if (byte < 0x80) code = byte;
      else if (byte >= 0xc2 && byte < 0xe0) code = ((byte & 0x1f) << 6) | (bytes[index++] & 0x3f);
      else if (byte >= 0xe0 && byte < 0xf0)
        code = ((byte & 0x0f) << 12) | ((bytes[index++] & 0x3f) << 6) | (bytes[index++] & 0x3f);
      else if (byte >= 0xf0 && byte < 0xf5)
        code =
          ((byte & 0x07) << 18) |
          ((bytes[index++] & 0x3f) << 12) |
          ((bytes[index++] & 0x3f) << 6) |
          (bytes[index++] & 0x3f);
      else fail('corrupt', 'The share link is damaged.');
      if (code === undefined || Number.isNaN(code)) fail('corrupt', 'The share link is damaged.');
      text += String.fromCodePoint(code);
    }
    return text;
  }

  function transform(bytes, stream) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }).pipeThrough(stream);
  }

  function createFactory({ model }) {
    /* Pack a normalized project into plain JSON values without IDs. */
    function pack(projectInput, initialView) {
      const project = model.normalizeProject(projectInput);
      const { manifest } = project;
      const base = dayNumber(`${manifest.year}-01-01`);
      const day = (date) => dayNumber(date) - base;
      const dimensionIndex = new Map();
      const optionIndex = new Map();
      manifest.dimensions.forEach((dimension, index) => {
        dimensionIndex.set(dimension.id, index);
        dimension.options.forEach((option, position) =>
          optionIndex.set(option.id, [index, position]),
        );
      });
      // Dependency indexes count the items first, then the milestones.
      const itemIndex = new Map([
        ...project.items.map((item, index) => [item.id, index]),
        ...project.milestones.map((point, index) => [point.id, project.items.length + index]),
      ]);
      const dependencies = (ids) => ids.map((id) => itemIndex.get(id));
      const defaults = model.normalizeViews(
        [{ id: model.uuid(), projectId: manifest.projectId, name: '-' }],
        project,
      )[0];
      const option = (id) => (id ? optionIndex.get(id)[1] + 1 : 0);

      function packView(view) {
        const packed = {};
        for (const [key, value] of Object.entries(view)) {
          if (OMITTED_VIEW_FIELDS.has(key)) continue;
          if (JSON.stringify(value) === JSON.stringify(defaults[key])) continue;
          if (DIMENSION_FIELDS.has(key)) packed[key] = value ? dimensionIndex.get(value) : '';
          else if (COLUMN_FIELDS.has(key))
            packed[key] = value.map((column) =>
              dimensionIndex.has(column) ? dimensionIndex.get(column) : column,
            );
          else if (key === 'filters')
            packed[key] = Object.fromEntries(
              Object.entries(value).map(([id, choice]) => [dimensionIndex.get(id), option(choice)]),
            );
          else if (key === 'colorOverrides')
            packed[key] = Object.fromEntries(
              Object.entries(value).map(([id, color]) => [
                optionIndex.get(id).join('.'),
                color.slice(1),
              ]),
            );
          else packed[key] = value;
        }
        return packed;
      }

      const payload = { n: manifest.name, y: manifest.year };
      if (manifest.description) payload.d = manifest.description;
      if (manifest.schedule === 'work-days') payload.w = 1;
      if (manifest.dimensions.length)
        payload.m = manifest.dimensions.map((dimension) => [
          dimension.name,
          dimension.options.map((choice) => [choice.name, choice.color.slice(1)]),
        ]);
      if (project.items.length)
        payload.i = project.items.map((item) =>
          trimTail(
            [
              item.title,
              day(item.start),
              day(item.end) - day(item.start),
              item.description,
              item.progress,
              trimZeros(manifest.dimensions.map((dimension) => option(item.values[dimension.id]))),
              dependencies(item.dependsOn),
            ],
            [null, null, null, '', 0, [], []],
          ),
        );
      if (project.milestones.length)
        payload.s = project.milestones.map((milestone) =>
          trimTail(
            [
              milestone.title,
              day(milestone.date),
              dependencies(milestone.dependsOn),
              milestone.fixed ? 1 : 0,
            ],
            [null, null, [], 0],
          ),
        );
      if (project.periodIndicators.length)
        payload.p = project.periodIndicators.map((period) =>
          trimTail(
            [
              period.title,
              day(period.start),
              day(period.end) - day(period.start),
              period.color.slice(1),
              period.vacation ? 1 : 0,
            ],
            [null, null, null, null, 1],
          ),
        );
      if (project.sharedViews.length)
        payload.v = project.sharedViews.map((view) => ({ name: view.name, ...packView(view) }));
      if (initialView) {
        const [view] = model.normalizeViews(
          [{ ...initialView, id: model.uuid(), projectId: manifest.projectId, name: '-' }],
          project,
        );
        payload.o = packView(view);
      }
      return payload;
    }

    /* The model names a record by its random ID or its place in the
       project; the reader of a link knows it by its place in the link and
       its title, so a validation error says `activity i[2] "Build"`. */
    function inPositions(raw, validate, initialView = false) {
      try {
        return validate();
      } catch (error) {
        if (error instanceof ShareLinkError) throw error;
        const label = (key, index, title) =>
          typeof title === 'string' && title
            ? `${key}[${index}] ${JSON.stringify(title.length > 40 ? `${title.slice(0, 40)}…` : title)}`
            : `${key}[${index}]`;
        const names = new Map([[raw.manifest.projectId, 'the roadmap']]);
        const lists = {
          items: ['activity', 'i', (record) => record.title],
          milestones: ['milestone', 's', (record) => record.title],
          periodIndicators: ['period', 'p', (record) => record.title],
          sharedViews: ['view', 'v', (record) => record.name],
        };
        for (const [field, [kind, key, title]] of Object.entries(lists))
          raw[field].forEach((record, index) =>
            names.set(record.id, `${kind} ${label(key, index, title(record))}`),
          );
        raw.manifest.dimensions.forEach((dimension, index) => {
          names.set(dimension.id, `dimension ${label('m', index, dimension.name)}`);
          dimension.options.forEach((choice, position) =>
            names.set(choice.id, `option ${position + 1} of dimension m[${index}]`),
          );
        });
        const message = String(error.message)
          .replace(
            /\b(items|milestones|periodIndicators|sharedViews)\[(\d+)\]/g,
            (text, field, index) => {
              if (initialView && field === 'sharedViews') return 'initial view o';
              const record = raw[field][Number(index)];
              return record ? names.get(record.id) : text;
            },
          )
          .replace(/\b(?:items|milestones|periodIndicators|sharedViews)\.([0-9a-f-]{36})/gi, '$1')
          .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (id) =>
            names.has(id) ? names.get(id) : id,
          );
        throw new Error(message);
      }
    }

    /* Rebuild a canonical project with fresh IDs from packed values, or with
       the IDs of `like`, position for position, so that a newer link of the
       same roadmap replaces it in place. */
    function unpack(payload, { like = null } = {}) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        fail('invalid', 'The share link holds no project.');
      const list = (value) => {
        if (value === undefined) return [];
        if (!Array.isArray(value)) fail('invalid', 'The share link has a malformed list.');
        return value;
      };
      const integer = (value) => {
        if (!Number.isSafeInteger(value) || Math.abs(value) > 200000)
          fail('invalid', 'The share link has a malformed number.');
        return value;
      };
      const at = (values, index) => {
        if (!Number.isInteger(index) || index < 0 || index >= values.length)
          fail('invalid', 'The share link refers to a missing entry.');
        return values[index];
      };
      const year = integer(payload.y);
      const base = dayNumber(`${String(year).padStart(4, '0')}-01-01`);
      if (!Number.isFinite(base)) fail('invalid', 'The share link has an invalid year.');
      const date = (offset) => new Date((base + integer(offset)) * DAY).toISOString().slice(0, 10);
      const color = (value) => `#${value}`;
      const id = (record) => record?.id ?? model.uuid();
      const projectId = like?.manifest.projectId ?? model.uuid();
      const own = (record, earlier) => ({ id: id(earlier), projectId, ...record });

      const dimensions = list(payload.m).map((entry, index) => {
        const [name, options] = list(entry);
        const earlier = like?.manifest.dimensions[index];
        return {
          id: id(earlier),
          name,
          options: list(options).map((choice, position) => {
            const [optionName, optionColor] = list(choice);
            return {
              id: id(earlier?.options[position]),
              name: optionName,
              color: color(optionColor),
            };
          }),
        };
      });
      const option = (dimension, choice) =>
        integer(choice) === 0 ? '' : at(dimension.options, choice - 1).id;
      const packedItems = list(payload.i).map(list);
      const itemIds = packedItems.map((_, index) => id(like?.items[index]));
      const milestoneIds = list(payload.s).map((_, index) => id(like?.milestones[index]));
      const dependencies = (value) => list(value).map((index) => at(itemIds, index));
      // An activity may also wait for a milestone, counted after the items.
      const predecessors = [...itemIds, ...milestoneIds];

      const objectValue = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value))
          fail('invalid', 'The share link has a malformed view.');
        return value;
      };

      function unpackView(packed) {
        objectValue(packed);
        const view = {};
        for (const [key, value] of Object.entries(packed)) {
          if (DIMENSION_FIELDS.has(key)) view[key] = value === '' ? '' : at(dimensions, value).id;
          else if (COLUMN_FIELDS.has(key))
            view[key] = list(value).map((column) =>
              typeof column === 'number' ? at(dimensions, column).id : column,
            );
          else if (key === 'filters')
            view[key] = Object.fromEntries(
              Object.entries(objectValue(value)).map(([index, choice]) => {
                const dimension = at(dimensions, Number(index));
                return [dimension.id, option(dimension, choice)];
              }),
            );
          else if (key === 'colorOverrides')
            view[key] = Object.fromEntries(
              Object.entries(objectValue(value)).map(([position, overrideColor]) => {
                const [index, choice] = position.split('.').map(Number);
                return [at(at(dimensions, index).options, choice).id, color(overrideColor)];
              }),
            );
          else if (!OMITTED_VIEW_FIELDS.has(key)) view[key] = value;
        }
        return view;
      }

      const raw = {
        manifest: {
          projectId,
          formatVersion: 1,
          ...(payload.c === undefined ? {} : { shareLinkCreatedAt: payload.c }),
          name: payload.n,
          description: payload.d ?? '',
          dimensions,
          year,
          schedule: payload.w === undefined ? 'calendar-days' : payload.w === 1 ? 'work-days' : '',
        },
        items: packedItems.map((entry, index) => {
          const [title, start, length, description = '', progress = 0, values, dependsOn] = entry;
          const choices = list(values);
          if (choices.length > dimensions.length)
            fail('invalid', 'The share link refers to a missing entry.');
          return {
            id: itemIds[index],
            projectId,
            title,
            description,
            progress,
            start: date(start),
            end: date(integer(start) + integer(length)),
            values: Object.fromEntries(
              choices
                .map((choice, position) => [
                  dimensions[position].id,
                  option(dimensions[position], choice),
                ])
                .filter(([, id]) => id),
            ),
            dependsOn: list(dependsOn).map((position) => at(predecessors, position)),
          };
        }),
        sharedViews: list(payload.v).map((packed, index) =>
          own({ ...unpackView(packed), name: packed.name }, like?.sharedViews[index]),
        ),
        milestones: list(payload.s).map((entry, index) => {
          const [title, day, dependsOn, fixed = 0] = list(entry);
          if (fixed !== 0 && fixed !== 1)
            fail('invalid', 'The share link has an invalid milestone.');
          return {
            id: milestoneIds[index],
            projectId,
            title,
            date: date(day),
            dependsOn: dependencies(dependsOn),
            fixed: fixed === 1,
          };
        }),
        periodIndicators: list(payload.p).map((entry, index) => {
          const [title, start, length, periodColor, vacation = 1] = list(entry);
          if (vacation !== 0 && vacation !== 1)
            fail('invalid', 'The share link has an invalid period.');
          return own(
            {
              title,
              start: date(start),
              end: date(integer(start) + integer(length)),
              color: color(periodColor),
              vacation: vacation === 1,
            },
            like?.periodIndicators[index],
          );
        }),
      };
      const project = inPositions(raw, () => model.normalizeProject(raw));
      let view = null;
      if (payload.o !== undefined) {
        const [normalized] = inPositions(
          raw,
          () => model.normalizeViews([own({ ...unpackView(payload.o), name: '-' })], project),
          true,
        );
        view = Object.fromEntries(
          Object.entries(normalized).filter(([key]) => !OMITTED_VIEW_FIELDS.has(key)),
        );
      }
      return { project, view };
    }

    /**
     * A smaller copy of a project and its initial view for a link (ADR-085):
     * `visibleItemIds` keeps only those activities and the dependencies
     * between them, `withoutDescriptions` empties the roadmap's and the
     * activities' descriptions, `withoutSavedViews` drops the saved views,
     * and `withoutUnusedDimensions` drops dimensions and options no kept
     * activity uses, clearing view settings that referred to them. The
     * original is not changed.
     */
    function reduce(projectInput, initialView = null, options = {}) {
      const source = model.normalizeProject(projectInput);
      const project = JSON.parse(JSON.stringify(source));
      let view = initialView ? JSON.parse(JSON.stringify(initialView)) : null;
      if (options.visibleItemIds) {
        // Milestones stay, so activities keep waiting for fixed ones.
        const kept = new Set([
          ...options.visibleItemIds,
          ...project.milestones.filter((point) => point.fixed).map((point) => point.id),
        ]);
        project.items = project.items.filter((item) => kept.has(item.id));
        for (const record of [...project.items, ...project.milestones])
          record.dependsOn = record.dependsOn.filter((id) => kept.has(id));
      }
      if (options.withoutDescriptions) {
        project.manifest.description = '';
        for (const item of project.items) item.description = '';
      }
      if (options.withoutSavedViews) project.sharedViews = [];
      if (options.withoutUnusedDimensions) {
        const used = new Set(project.items.flatMap((item) => Object.values(item.values)));
        const dimensions = project.manifest.dimensions
          .map((dimension) => ({
            ...dimension,
            options: dimension.options.filter((choice) => used.has(choice.id)),
          }))
          .filter((dimension) => dimension.options.length);
        const dimensionIds = new Set(dimensions.map((dimension) => dimension.id));
        const optionIds = new Set(
          dimensions.flatMap((dimension) => dimension.options.map((choice) => choice.id)),
        );
        project.manifest.dimensions = dimensions;
        for (const item of project.items)
          item.values = Object.fromEntries(
            Object.entries(item.values).filter(([id, choice]) => dimensionIds.has(id) && choice),
          );
        const prune = (record) => {
          if (!record) return record;
          for (const key of DIMENSION_FIELDS)
            if (record[key] && !dimensionIds.has(record[key])) record[key] = '';
          for (const key of COLUMN_FIELDS)
            if (Array.isArray(record[key]))
              record[key] = record[key].filter(
                (column) => ['title', 'start', 'end'].includes(column) || dimensionIds.has(column),
              );
          if (record.filters)
            record.filters = Object.fromEntries(
              Object.entries(record.filters).filter(
                ([id, choice]) => dimensionIds.has(id) && (!choice || optionIds.has(choice)),
              ),
            );
          if (record.colorOverrides)
            record.colorOverrides = Object.fromEntries(
              Object.entries(record.colorOverrides).filter(([id]) => optionIds.has(id)),
            );
          return record;
        };
        project.sharedViews.forEach(prune);
        view = prune(view);
      }
      return { project: model.normalizeProject(project), view };
    }

    /**
     * Encode a project and an optional initial view configuration as a
     * fragment such as `s=1.…`, without the leading `#`. Throws a
     * `ShareLinkError` with code `too-large` (and `length`, `limit`) when
     * the result exceeds the limit; nothing is ever truncated. New links get
     * their creation time in UTC, independent of the source copy's metadata.
     * `createdAt: null` omits it for deterministic static templates.
     */
    async function encode(
      project,
      initialView = null,
      { createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') } = {},
    ) {
      const payload = pack(project, initialView);
      if (createdAt !== null) {
        model.normalizeManifest({ ...project.manifest, shareLinkCreatedAt: createdAt });
        payload.c = createdAt;
      }
      const json = JSON.stringify(payload);
      const bytes = await readAll(
        transform(new TextEncoder().encode(json), new CompressionStream('deflate-raw')),
        Infinity,
      );
      const fragment = PREFIX + toBase64Url(bytes);
      if (fragment.length > MAX_FRAGMENT_LENGTH)
        fail('too-large', 'The roadmap is too large for a share link.', {
          length: fragment.length,
          limit: MAX_FRAGMENT_LENGTH,
        });
      return fragment;
    }

    /**
     * Decode a fragment (with or without `#`) into `{ project, view }`: a
     * validated project under new IDs and the normalized initial view, or
     * `null`; `options.like` keeps that project's IDs (see `unpack`). Error
     * codes: `not-share-link`, `unsupported-version`, `too-large`, `corrupt`,
     * `invalid`.
     */
    async function decode(fragment, options) {
      const text = typeof fragment === 'string' ? fragment.replace(/^#/, '') : '';
      const match = /^s=(\d+)\.(.*)$/s.exec(text);
      if (!match) fail('not-share-link', 'This is not a share link.');
      if (match[1] !== String(VERSION))
        fail('unsupported-version', 'This share link needs a newer version of Tidigar.');
      if (text.length > MAX_FRAGMENT_LENGTH)
        fail('too-large', 'The share link is too long.', {
          length: text.length,
          limit: MAX_FRAGMENT_LENGTH,
        });
      if (!/^[A-Za-z0-9_-]+$/.test(match[2])) fail('corrupt', 'The share link is damaged.');
      let payload;
      try {
        const bytes = await readAll(
          transform(fromBase64Url(match[2]), new DecompressionStream('deflate-raw')),
          MAX_INFLATED_BYTES,
        );
        payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      } catch (error) {
        if (error instanceof ShareLinkError) throw error;
        fail('corrupt', 'The share link is damaged.');
      }
      try {
        return unpack(payload, options);
      } catch (error) {
        if (error instanceof ShareLinkError) throw error;
        fail('invalid', `The share link holds an invalid roadmap. ${error.message}`);
      }
    }

    /**
     * `decode` without waiting and without web APIs, for a start that cannot
     * wait and for engines without streams, such as the apps' model runtime.
     */
    function decodeSync(fragment, options) {
      const text = typeof fragment === 'string' ? fragment.replace(/^#/, '') : '';
      const match = /^s=(\d+)\.(.*)$/s.exec(text);
      if (!match) fail('not-share-link', 'This is not a share link.');
      if (match[1] !== String(VERSION))
        fail('unsupported-version', 'This share link needs a newer version of Tidigar.');
      if (text.length > MAX_FRAGMENT_LENGTH)
        fail('too-large', 'The share link is too long.', {
          length: text.length,
          limit: MAX_FRAGMENT_LENGTH,
        });
      if (!/^[A-Za-z0-9_-]+$/.test(match[2])) fail('corrupt', 'The share link is damaged.');
      let payload;
      try {
        payload = JSON.parse(utf8Text(inflateRaw(base64UrlBytes(match[2]), MAX_INFLATED_BYTES)));
      } catch (error) {
        if (error instanceof ShareLinkError) throw error;
        fail('corrupt', 'The share link is damaged.');
      }
      try {
        return unpack(payload, options);
      } catch (error) {
        if (error instanceof ShareLinkError) throw error;
        fail('invalid', `The share link holds an invalid roadmap. ${error.message}`);
      }
    }

    return { encode, decode, decodeSync, pack, unpack, reduce };
  }

  // Public addresses (ADR-077, ADR-078): the opener that makes a copy in the
  // reader's Tidigar, and the embed edition a blog frames.
  const OPENER_URL = 'https://open.tidigar.com/s';
  const EMBED_URL = 'https://embed.tidigar.com/';

  const escapeHTML = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
    );

  /* The HTML a blog pastes: the embed frame and a plain link that still
     works where a platform removes frames. A page that is always dark or
     always light passes `theme`, which the embed keeps whatever the reader's
     setting; it goes in the frame's name, so the address stays the same. */
  function embedCode(fragment, { title, linkText, theme = null }) {
    const name = theme === 'dark' || theme === 'light' ? ` name="tidigar-theme-${theme}"` : '';
    return (
      `<iframe src="${EMBED_URL}#${fragment}"${name} title="${escapeHTML(title)}" width="100%" ` +
      `height="480" style="border:0;max-width:100%" loading="lazy"></iframe>\n` +
      `<p><a href="${OPENER_URL}#${fragment}">${escapeHTML(linkText)}</a></p>\n` +
      // Sets the iframe to the height of its roadmap; without it the height
      // above applies. The escaped slash keeps this source inline in HTML.
      `<script async src="${EMBED_URL}embed.js"><\/script>`
    );
  }

  return {
    createFactory,
    embedCode,
    ShareLinkError,
    VERSION,
    MAX_FRAGMENT_LENGTH,
    MAX_INFLATED_BYTES,
    OPENER_URL,
    EMBED_URL,
  };
});
})(scope);
(function (globalThis) {
/* The plan format for AI agents (ADR-185): a roadmap written with real
   dates, names and titles instead of the share link's day offsets and
   positions. `toPayload` turns a plan into a share-link payload and fills in
   what is not semantic: the year, option colors and a timeline that fits the
   plan. `fromPayload` reads a payload back into a plan an agent can edit.
   The schema at tidigar.com/schema/plan-v1.json describes the same format. */
(function installTidigarPlan(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.tidigarPlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTidigarPlan() {
  'use strict';

  const DAY = 86400000;
  const SCHEMA = 'https://tidigar.com/schema/plan-v1.json';
  const COLORS = ['4f7cff', '16a34a', 'f59e0b', '8a52c1', '0891b2', 'dc5f5f', '64748b', 'db2777'];
  const PERIOD_COLOR = '9aa7b5';
  const VIEW_TYPES = ['timeline', 'grid', 'list', 'flow'];
  // Plan view keys and the link's view fields they set; the dimension
  // references hold a dimension's name in the plan and its index in a link.
  const VIEW_FIELDS = {
    type: 'view',
    groupBy: 'group',
    colorBy: 'color',
    rows: 'row',
    columns: 'col',
    start: 'timelineStart',
    end: 'timelineEnd',
  };
  const DIMENSION_VIEW_KEYS = new Set(['groupBy', 'colorBy', 'rows', 'columns']);
  const KEYS = {
    plan: [
      '$schema',
      'version',
      'name',
      'description',
      'workDays',
      'dimensions',
      'activities',
      'milestones',
      'periods',
      'view',
    ],
    activity: ['title', 'start', 'end', 'description', 'progress', 'values', 'dependsOn'],
    milestone: ['title', 'date', 'dependsOn', 'fixed'],
    period: ['title', 'start', 'end', 'color', 'vacation'],
    option: ['name', 'color'],
    view: Object.keys(VIEW_FIELDS),
  };

  class PlanError extends Error {
    constructor(message) {
      super(message);
      this.name = 'PlanError';
    }
  }

  const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const dayNumber = (date) => Date.parse(`${date}T00:00:00Z`) / DAY;
  const isoDate = (day) => new Date(day * DAY).toISOString().slice(0, 10);

  /** Turn a plan into a share-link payload, or throw a PlanError naming the field. */
  function toPayload(plan) {
    const fail = (path, message) => {
      throw new PlanError(`Invalid ${path}: ${message}`);
    };
    const record = (value, path, kind) => {
      if (!isRecord(value)) fail(path, 'expected an object');
      for (const key of Object.keys(value))
        if (!KEYS[kind].includes(key))
          fail(
            `${path}.${key}`,
            `unknown field; use ${KEYS[kind].join(', ')}${kind === 'activity' ? '. Dimension options go in values, such as "values": { "Team": "Design" }' : ''}`,
          );
      return value;
    };
    const list = (value, path) => {
      if (value === undefined) return [];
      if (!Array.isArray(value)) fail(path, 'expected an array');
      return value;
    };
    const text = (value, path, fallback) => {
      if (value === undefined && fallback !== undefined) return fallback;
      if (typeof value !== 'string') fail(path, 'expected text');
      return value;
    };
    const date = (value, path) => {
      if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        isoDate(dayNumber(value)) !== value
      )
        fail(path, 'expected a date as YYYY-MM-DD');
      return dayNumber(value);
    };
    const color = (value, path) => {
      if (typeof value !== 'string' || !/^#?[0-9a-f]{6}$/i.test(value))
        fail(path, 'expected a color as #rrggbb');
      return value.replace('#', '').toLowerCase();
    };
    const named = (path, title) =>
      typeof title === 'string' && title ? `${path} ${JSON.stringify(title)}` : path;

    record(plan, 'plan', 'plan');
    if (plan.version !== undefined && plan.version !== 1) fail('version', 'must be 1');
    const name = text(plan.name, 'name');

    // Dimensions keep the order they are declared in, then the order an
    // activity first names them; options likewise.
    const dimensions = [];
    const dimensionNamed = (dimensionName, path) => {
      let dimension = dimensions.find((candidate) => candidate.name === dimensionName);
      if (!dimension) {
        if (!dimensionName.trim()) fail(path, 'a dimension needs a name');
        dimension = { name: dimensionName, options: [] };
        dimensions.push(dimension);
      }
      return dimension;
    };
    const addOption = (dimension, optionName, optionColor, path) => {
      if (dimension.options.some((option) => option.name === optionName))
        fail(path, `${JSON.stringify(optionName)} is listed twice`);
      dimension.options.push({
        name: optionName,
        color: optionColor ?? COLORS[dimension.options.length % COLORS.length],
      });
    };
    if (plan.dimensions !== undefined) {
      if (!isRecord(plan.dimensions)) fail('dimensions', 'expected an object of name → options');
      for (const [dimensionName, options] of Object.entries(plan.dimensions)) {
        const path = `dimensions.${JSON.stringify(dimensionName)}`;
        const dimension = dimensionNamed(dimensionName, path);
        list(options, path).forEach((option, index) => {
          const optionPath = `${path}[${index}]`;
          if (typeof option === 'string') return addOption(dimension, option, null, optionPath);
          record(option, optionPath, 'option');
          addOption(
            dimension,
            text(option.name, `${optionPath}.name`),
            option.color === undefined ? null : color(option.color, `${optionPath}.color`),
            optionPath,
          );
        });
      }
    }

    const activities = list(plan.activities, 'activities').map((activity, index) =>
      record(activity, named(`activities[${index}]`, activity?.title), 'activity'),
    );
    const titles = new Map();
    activities.forEach((activity, index) => {
      if (typeof activity.title !== 'string') return;
      titles.set(activity.title, titles.has(activity.title) ? -1 : index);
    });
    // An activity may also wait for a fixed milestone, named by its
    // title; in the link it counts after the activities.
    const fixed = new Map();
    list(plan.milestones, 'milestones').forEach((milestone, index) => {
      if (milestone?.fixed !== true || typeof milestone.title !== 'string') return;
      fixed.set(milestone.title, fixed.has(milestone.title) ? -1 : index);
    });
    const dependencies = (value, path, milestones = false) =>
      list(value, path).map((reference, position) => {
        const at = `${path}[${position}]`;
        if (Number.isInteger(reference)) {
          if (reference < 0 || reference >= activities.length)
            fail(at, `there is no activities[${reference}]`);
          return reference;
        }
        if (typeof reference !== 'string') fail(at, 'expected an activity title or index');
        const found = titles.get(reference);
        if (found === undefined && milestones && fixed.has(reference)) {
          if (fixed.get(reference) < 0)
            fail(at, `several fixed milestones are titled ${JSON.stringify(reference)}`);
          return activities.length + fixed.get(reference);
        }
        if (found === undefined)
          fail(
            at,
            `no activity${milestones && fixed.size ? ' or fixed milestone' : ''} is titled ${JSON.stringify(reference)}`,
          );
        if (found < 0)
          fail(at, `several activities are titled ${JSON.stringify(reference)}; use an index`);
        return found;
      });

    const dated = [];
    const items = activities.map((activity, index) => {
      const path = named(`activities[${index}]`, activity.title);
      const start = date(activity.start, `${path}.start`);
      const end = activity.end === undefined ? start : date(activity.end, `${path}.end`);
      if (end < start) fail(`${path}.end`, 'must not be before start');
      dated.push(start, end);
      const values = [];
      if (activity.values !== undefined) {
        if (!isRecord(activity.values)) fail(`${path}.values`, 'expected dimension → option');
        for (const [dimensionName, optionName] of Object.entries(activity.values)) {
          const at = `${path}.values.${JSON.stringify(dimensionName)}`;
          const dimension = dimensionNamed(dimensionName, at);
          if (optionName === null || optionName === '') continue;
          text(optionName, at);
          let position = dimension.options.findIndex((option) => option.name === optionName);
          if (position < 0) {
            addOption(dimension, optionName, null, at);
            position = dimension.options.length - 1;
          }
          values[dimensions.indexOf(dimension)] = position + 1;
        }
      }
      return {
        title: text(activity.title, `${path}.title`, ''),
        start,
        length: end - start,
        description: text(activity.description, `${path}.description`, ''),
        progress: activity.progress ?? 0,
        values: Array.from(values, (value) => value ?? 0),
        dependsOn: dependencies(activity.dependsOn, `${path}.dependsOn`, true),
      };
    });
    const milestones = list(plan.milestones, 'milestones').map((milestone, index) => {
      const path = named(`milestones[${index}]`, milestone?.title);
      record(milestone, path, 'milestone');
      const day = date(milestone.date, `${path}.date`);
      dated.push(day);
      if (milestone.fixed !== undefined && typeof milestone.fixed !== 'boolean')
        fail(`${path}.fixed`, 'expected true or false');
      if (milestone.fixed && list(milestone.dependsOn, `${path}.dependsOn`).length)
        fail(`${path}.dependsOn`, 'a fixed milestone waits for nothing');
      return {
        title: text(milestone.title, `${path}.title`),
        day,
        dependsOn: dependencies(milestone.dependsOn, `${path}.dependsOn`),
        fixed: milestone.fixed === true,
      };
    });
    const periods = list(plan.periods, 'periods').map((period, index) => {
      const path = named(`periods[${index}]`, period?.title);
      record(period, path, 'period');
      const start = date(period.start, `${path}.start`);
      const end = period.end === undefined ? start : date(period.end, `${path}.end`);
      if (end < start) fail(`${path}.end`, 'must not be before start');
      if (period.vacation !== undefined && typeof period.vacation !== 'boolean')
        fail(`${path}.vacation`, 'expected true or false');
      dated.push(start, end);
      return {
        title: text(period.title, `${path}.title`),
        start,
        length: end - start,
        color: period.color === undefined ? PERIOD_COLOR : color(period.color, `${path}.color`),
        vacation: period.vacation !== false,
      };
    });
    if (plan.workDays !== undefined && typeof plan.workDays !== 'boolean')
      fail('workDays', 'expected true or false');

    // The year is the first date's; a plan without dates starts this year.
    const first = dated.length ? Math.min(...dated) : null;
    const last = dated.length ? Math.max(...dated) : null;
    const year = Number((first === null ? new Date().toISOString() : isoDate(first)).slice(0, 4));
    const base = dayNumber(`${String(year).padStart(4, '0')}-01-01`);

    const trim = (values, defaults) => {
      while (
        values.length &&
        JSON.stringify(values.at(-1)) === JSON.stringify(defaults[values.length - 1])
      )
        values.pop();
      return values;
    };
    const payload = { n: name, y: year };
    if (plan.description !== undefined) payload.d = text(plan.description, 'description');
    if (plan.workDays) payload.w = 1;
    if (dimensions.length)
      payload.m = dimensions.map((dimension) => [
        dimension.name,
        dimension.options.map((option) => [option.name, option.color]),
      ]);
    if (items.length)
      payload.i = items.map((item) => {
        const values = item.values.slice();
        while (values.length && values.at(-1) === 0) values.pop();
        return trim(
          [
            item.title,
            item.start - base,
            item.length,
            item.description,
            item.progress,
            values,
            item.dependsOn,
          ],
          [null, null, null, '', 0, [], []],
        );
      });
    if (milestones.length)
      payload.s = milestones.map((milestone) =>
        trim(
          [milestone.title, milestone.day - base, milestone.dependsOn, milestone.fixed ? 1 : 0],
          [null, null, [], 0],
        ),
      );
    if (periods.length)
      payload.p = periods.map((period) =>
        trim(
          [period.title, period.start - base, period.length, period.color, period.vacation ? 1 : 0],
          [null, null, null, null, 1],
        ),
      );

    // The view: a timeline grouped and colored by the first dimension over
    // the plan's dates, unless the plan says otherwise.
    const view = plan.view === undefined ? {} : record(plan.view, 'view', 'view');
    const dimensionIndex = (value, path) => {
      if (value === null || value === '') return '';
      text(value, path);
      const index = dimensions.findIndex((dimension) => dimension.name === value);
      if (index < 0) fail(path, `there is no dimension ${JSON.stringify(value)}`);
      return index;
    };
    const o = {};
    for (const [key, field] of Object.entries(VIEW_FIELDS)) {
      if (view[key] === undefined) continue;
      const path = `view.${key}`;
      if (DIMENSION_VIEW_KEYS.has(key)) o[field] = dimensionIndex(view[key], path);
      else if (key === 'type') {
        if (!VIEW_TYPES.includes(view.type)) fail(path, `must be ${VIEW_TYPES.join(', ')}`);
        o.view = view.type;
      } else o[field] = isoDate(date(view[key], path));
    }
    o.view ??= 'timeline';
    if (dimensions.length) {
      if (o.view === 'grid') {
        o.row ??= 0;
        if (dimensions.length > 1) o.col ??= 1;
      }
      o.color ??= 0;
      if (o.view === 'timeline') o.group ??= 0;
    }
    if (first !== null) {
      o.timelineStart ??= isoDate(first);
      o.timelineEnd ??= isoDate(last);
      if (o.timelineEnd < o.timelineStart) fail('view.end', 'must not be before view.start');
    }
    payload.o = o;
    return payload;
  }

  /** Read a share-link payload back into a plan. Saved views (`v`) and view
      settings the plan has no field for are not carried; `lost` names them. */
  function fromPayload(payload) {
    const base = dayNumber(`${String(payload.y).padStart(4, '0')}-01-01`);
    const day = (offset) => isoDate(base + offset);
    const dimensions = (payload.m || []).map(([name, options]) => ({ name, options }));
    const items = payload.i || [];
    const counts = new Map();
    for (const [title = ''] of items) counts.set(title, (counts.get(title) || 0) + 1);
    const reference = (index) => {
      // Past the activities, an index is a fixed milestone, named by title.
      if (index >= items.length) return payload.s[index - items.length][0];
      const title = items[index][0] ?? '';
      return title && counts.get(title) === 1 ? title : index;
    };
    const plan = { $schema: SCHEMA, version: 1, name: payload.n };
    if (payload.d) plan.description = payload.d;
    if (payload.w === 1) plan.workDays = true;
    if (dimensions.length)
      plan.dimensions = Object.fromEntries(
        dimensions.map(({ name, options }) => [
          name,
          options.map(([option, color], position) =>
            color === COLORS[position % COLORS.length]
              ? option
              : { name: option, color: `#${color}` },
          ),
        ]),
      );
    if (items.length)
      plan.activities = items.map(
        ([
          title = '',
          start,
          length,
          description = '',
          progress = 0,
          values = [],
          dependsOn = [],
        ]) => {
          const activity = { title, start: day(start), end: day(start + length) };
          if (description) activity.description = description;
          if (progress) activity.progress = progress;
          const chosen = values
            .map((choice, index) => [dimensions[index], choice])
            .filter(([, choice]) => choice > 0);
          if (chosen.length)
            activity.values = Object.fromEntries(
              chosen.map(([dimension, choice]) => [
                dimension.name,
                dimension.options[choice - 1][0],
              ]),
            );
          if (dependsOn.length) activity.dependsOn = dependsOn.map(reference);
          return activity;
        },
      );
    if (payload.s?.length)
      plan.milestones = payload.s.map(([title, date, dependsOn = [], fixed = 0]) => {
        const milestone = { title, date: day(date) };
        if (dependsOn.length) milestone.dependsOn = dependsOn.map(reference);
        if (fixed === 1) milestone.fixed = true;
        return milestone;
      });
    if (payload.p?.length)
      plan.periods = payload.p.map(([title, start, length, color, vacation = 1]) => {
        const period = { title, start: day(start), end: day(start + length) };
        if (color !== PERIOD_COLOR) period.color = `#${color}`;
        if (vacation === 0) period.vacation = false;
        return period;
      });
    const lost = payload.v?.length ? ['saved views'] : [];
    if (payload.o) {
      const view = {};
      for (const [key, field] of Object.entries(VIEW_FIELDS)) {
        const value = payload.o[field];
        if (value === undefined) continue;
        if (DIMENSION_VIEW_KEYS.has(key)) view[key] = value === '' ? null : dimensions[value].name;
        else view[key] = value;
      }
      view.type ??= 'grid';
      plan.view = view;
      // resolution no longer changes what a view shows.
      const carried = new Set([...Object.values(VIEW_FIELDS), 'resolution']);
      const other = Object.keys(payload.o).filter((field) => !carried.has(field));
      if (other.length) lost.push(`view settings ${other.join(', ')}`);
    }
    return { plan, lost };
  }

  /** Whether a JSON value is a plan rather than a share-link payload. */
  function isPlan(value) {
    return isRecord(value) && !('n' in value) && ('name' in value || 'activities' in value);
  }

  return Object.freeze({ SCHEMA, COLORS, PlanError, toPayload, fromPayload, isPlan });
});
})(scope);

const model = scope.tidigarModel;
const shareLink = scope.tidigarShareLink;
const planFormat = scope.tidigarPlan;
const codec = shareLink.createFactory({ model });

export const OPENER_URL = shareLink.OPENER_URL;
export const MAX_FRAGMENT_LENGTH = shareLink.MAX_FRAGMENT_LENGTH;
export const PLAN_SCHEMA = planFormat.SCHEMA;

// A summary and an error name records the way the input does: by their
// place in a plan's lists, or by their place in a payload's.
const PAYLOAD_LABELS = { i: 'i', s: 's', p: 'p', v: 'v' };
const PLAN_LABELS = { i: 'activities', s: 'milestones', p: 'periods', v: 'views' };

function inPlanTerms(error) {
  error.message = error.message
    .replace(/\bactivity i\[/g, 'activities[')
    .replace(/\bmilestone s\[/g, 'milestones[')
    .replace(/\bperiod p\[/g, 'periods[')
    .replace(/\binitial view o\b/g, 'view')
    .replace(/\bmanifest\./g, '');
  return error;
}

/* What a link holds, one record per line, with its place in the payload,
   real dates and dependencies, for checking a plan against the request. */
function describe(project, labels = PAYLOAD_LABELS) {
  const position = new Map();
  project.items.forEach((item, index) => position.set(item.id, `${labels.i}[${index}]`));
  project.milestones.forEach((point, index) => position.set(point.id, `${labels.s}[${index}]`));
  const after = (record) =>
    record.dependsOn.length
      ? ` · after ${record.dependsOn.map((id) => position.get(id)).join(', ')}`
      : '';
  const values = (item) =>
    project.manifest.dimensions
      .map((dimension) => {
        const choice = dimension.options.find((option) => option.id === item.values[dimension.id]);
        return choice ? ` · ${dimension.name}: ${choice.name}` : '';
      })
      .join('');
  const { manifest, items, milestones, periodIndicators, sharedViews } = project;
  return [
    `${manifest.name} (${manifest.year}${manifest.schedule === 'work-days' ? ', work days' : ''})`,
    ...items.map(
      (item, index) =>
        `${labels.i}[${index}] ${item.title || '(untitled)'}: ${item.start} – ${item.end}` +
        `${item.progress ? ` · ${item.progress}% done` : ''}${values(item)}${after(item)}`,
    ),
    ...milestones.map(
      (milestone, index) =>
        `${labels.s}[${index}] ${milestone.title}: ${milestone.date}` +
        `${milestone.fixed ? ' · fixed' : ''}${after(milestone)}`,
    ),
    ...periodIndicators.map(
      (period, index) => `${labels.p}[${index}] ${period.title}: ${period.start} – ${period.end}`,
    ),
    ...sharedViews.map((view, index) => `${labels.v}[${index}] view ${view.name}: ${view.view}`),
  ].join('\n');
}

function fragmentOf(link) {
  const text = String(link).trim();
  const hash = text.indexOf('#');
  return hash < 0 ? text : text.slice(hash + 1);
}

/** Turn a plan into the share-link payload it makes; a payload is returned as is. */
export function toPayload(input) {
  if (typeof input === 'string') input = JSON.parse(input);
  return planFormat.isPlan(input) ? planFormat.toPayload(input) : input;
}

/**
 * Validate a plan or a share-link payload and build its link. Returns `{
 * url, fragment, length, summary, payload }`, where `length` is the
 * fragment's length against `MAX_FRAGMENT_LENGTH`. Throws an error whose
 * message names the broken rule and the record, such as `activities[2]
 * "Build"` for a plan or `activity i[2] "Build"` for a payload.
 */
export async function createLink(input, { createdAt } = {}) {
  if (typeof input === 'string') input = JSON.parse(input);
  const isPlan = planFormat.isPlan(input);
  const payload = toPayload(input);
  let project, view;
  try {
    ({ project, view } = codec.unpack(payload));
  } catch (error) {
    throw isPlan ? inPlanTerms(error) : error;
  }
  const fragment = await codec.encode(project, view, { createdAt }).catch((error) => {
    if (error.code === 'too-large')
      error.message += ` It needs ${error.length} of ${error.limit} characters; shorten or drop descriptions and merge small activities.`;
    throw error;
  });
  return {
    url: `${OPENER_URL}#${fragment}`,
    fragment,
    length: fragment.length,
    summary: describe(project, isPlan ? PLAN_LABELS : PAYLOAD_LABELS),
    payload: codec.pack(project, view),
  };
}

/**
 * Read a Tidigar link, or its fragment, into `{ plan, payload, summary,
 * lost }`. `plan` holds the roadmap as a plan to edit and rebuild; `lost`
 * names what the plan cannot carry, such as saved views, which the
 * `payload` keeps.
 */
export async function readLink(link, { labels = 'plan' } = {}) {
  const { project, view } = await codec.decode(fragmentOf(link));
  const payload = codec.pack(project, view);
  const { plan, lost } = planFormat.fromPayload(payload);
  return {
    plan,
    payload,
    lost,
    summary: describe(project, labels === 'plan' ? PLAN_LABELS : PAYLOAD_LABELS),
  };
}

/** HTML that shows a link's roadmap in a page, with the plain link below it. */
export function embedCode(link, title = 'Roadmap') {
  return shareLink.embedCode(fragmentOf(link), { title, linkText: `Open ${title} in Tidigar` });
}

async function main(args) {
  const { readFile } = await import('node:fs/promises');
  const flags = new Set(args.filter((arg) => arg.startsWith('--')));
  const [input] = args.filter((arg) => !arg.startsWith('--'));
  if (flags.has('--read')) {
    if (!input) throw new Error('Give the link to read.');
    const asPayload = flags.has('--payload');
    const { plan, payload, lost, summary } = await readLink(input, {
      labels: asPayload ? 'payload' : 'plan',
    });
    // The plan alone goes to standard output, so it can be saved and edited.
    console.log(JSON.stringify(asPayload ? payload : plan, null, 2));
    console.error(summary);
    if (!asPayload && lost.length)
      console.error(
        `The plan leaves out the link's ${lost.join(' and ')}; read it with --payload to keep them.`,
      );
    return;
  }
  if (!input)
    throw new Error('Give a plan file, or - for standard input. See tidigar.com/llms.txt.');
  let text = '';
  if (input === '-') for await (const chunk of process.stdin) text += chunk;
  else text = await readFile(input, 'utf8');
  const link = await createLink(JSON.parse(text));
  console.log(link.url);
  console.log(`\n${link.summary}`);
  console.log(`\nFragment: ${link.length} of ${MAX_FRAGMENT_LENGTH} characters.`);
  if (flags.has('--embed')) console.log(`\n${embedCode(link.url, link.payload.n)}`);
}

async function isMain() {
  if (import.meta.main !== undefined) return import.meta.main;
  const script = globalThis.process?.argv?.[1];
  if (!script) return false;
  const { pathToFileURL } = await import('node:url');
  const { realpath } = await import('node:fs/promises');
  return import.meta.url === pathToFileURL(await realpath(script)).href;
}

if (await isMain())
  await main(globalThis.process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    globalThis.process.exitCode = 1;
  });
