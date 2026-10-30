/* Tidigar links for AI agents and scripts.
   https://tidigar.com/llms.txt explains how to use this module.

   Run it with Node.js 20 or later, Deno or Bun:

     node tidigar-link.mjs plan.json           build a link from a plan
     node tidigar-link.mjs - < plan.json       the same, from standard input
     node tidigar-link.mjs --embed plan.json   also print embed code
     node tidigar-link.mjs --read "<link>" > plan.json   read a link as a plan

   Or import it: createLink(plan), readLink(link), embedCode(link, title).
   A plan has real dates and names (schema/plan-v1.json); the link is a
   readable one, `#t=1~…`. It validates a roadmap with the same code Tidigar
   uses when it opens a link, so a link it returns opens. Nothing is sent
   anywhere. */

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
  const TEXT_MODES = new Set(['hide', 'beside', 'run-past', 'fit', 'under']);
  const ACTIVITY_ROW_MODES = new Set(['single', 'single-label', 'compact']);
  const MILESTONE_MODES = new Set(['hide', 'marker', 'label', 'flag']);
  const WEEK_DAY_MODES = new Set(['work', 'all']);
  const DEPENDENCY_ARROW_MODES = new Set(['none', 'grouped', 'every']);
  const FLOW_DIRECTIONS = new Set(['auto', 'horizontal', 'vertical']);
  const SCHEDULES = new Set(['calendar-days', 'work-days']);
  // The reserved axis that arranges activities by who they are assigned to
  // in a Tidigar Cloud plan. It holds no people; dimension IDs are UUIDs, so
  // it never names a dimension.
  const ASSIGNEE_AXIS = 'assignee';
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
      wrapped: 'under',
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
  // How far into another activity one may start; 100, after its end, is the
  // default and is never stored.
  const START_AFTER_VALUES = new Set([0, 25, 50, 75]);
  // Allowed values of enumerated fields, published read-only so the model
  // specification test can compare them with docs/model-spec.md.
  const ENUM_VALUES = Object.freeze({
    'item.progress': Object.freeze([...PROGRESS_VALUES]),
    'manifest.schedule': Object.freeze([...SCHEDULES]),
    'view.view': Object.freeze([...VIEWS]),
    'view.resolution': Object.freeze([...RESOLUTIONS]),
    'view.timelineScaleRows': Object.freeze([1, 2, 3]),
    'view.textMode': Object.freeze([...TEXT_MODES]),
    'view.presentationStyle': Object.freeze([
      'standard',
      'minimal',
      'airy',
      'contrast',
      'terminal',
    ]),
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
  const MAX_REF_LENGTH = 32;
  const REF_PREFIX_PATTERN = /^[A-Z][A-Z0-9]{0,9}$/;

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
    const refPrefix = source.refPrefix === undefined ? '' : source.refPrefix;
    if (typeof refPrefix !== 'string' || (refPrefix && !REF_PREFIX_PATTERN.test(refPrefix)))
      invalid(
        'manifest.refPrefix',
        'must be up to 10 capital letters A to Z and digits, starting with a letter',
      );
    return {
      projectId,
      formatVersion: 1,
      name,
      description,
      dimensions,
      year: source.year,
      schedule,
      ...(shareLinkCreatedAt === undefined ? {} : { shareLinkCreatedAt }),
      // Only a project with reference keys carries its prefix.
      ...(refPrefix ? { refPrefix } : {}),
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

  // The share of another activity that has passed when one may start on it:
  // an object of predecessor IDs to 0, 25, 50 or 75. An entry outlives no
  // dependency: one for an ID outside `dependsOn` is dropped.
  function normalizeStartAfter(value, dependsOn, path) {
    if (value === undefined) return {};
    const source = requireRecord(value, path);
    for (const [id, percent] of Object.entries(source))
      if (!START_AFTER_VALUES.has(percent))
        invalid(`${path}.${id}`, 'must be one of 0, 25, 50, or 75');
    // Entries follow the order of `dependsOn`, so the field has one spelling.
    return Object.fromEntries(dependsOn.filter((id) => id in source).map((id) => [id, source[id]]));
  }

  /**
   * The first day an activity may start when it waits for `percent` of
   * `parent`: the day after its end for 100, else the day after that share
   * of its days, rounded up, has passed. With a work calendar the share is
   * counted in work days. Dates are UTC midnight timestamps.
   */
  function startThreshold(parent, percent = 100, calendar = null) {
    const start = dateTimestamp(parent.start);
    const after = dayAfter(parent.end);
    if (percent >= 100) return after;
    const length = calendar
      ? calendar.durationOf(start, after - DAY)
      : Math.round((after - start) / DAY);
    const days = Math.ceil((length * percent) / 100);
    if (!days) return start;
    const passed = calendar ? calendar.lastWorkDay(start, days) + DAY : start + days * DAY;
    return Math.min(passed, after);
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
    // records; a fixed milestone lets work start on its own date. An
    // activity that starts after part of another starts no earlier than that
    // one: editors place it by `startThreshold`, but the stored contract does
    // not depend on the work calendar, so a new vacation never invalidates a
    // project. Deserialization validates this contract and never moves user
    // dates as a side effect.
    for (const item of items) {
      for (const dependency of item.dependsOn) {
        const point = fixed.get(dependency);
        if (point) {
          if (item.startAfter?.[dependency] !== undefined)
            invalid(`${path}.${item.id}.startAfter`, `must not name fixed milestone ${dependency}`);
          if (item.start < point.date)
            invalid(`${path}.${item.id}.start`, `must not be before fixed milestone ${dependency}`);
          continue;
        }
        const parent = byId.get(dependency);
        if (item.startAfter?.[dependency] !== undefined) {
          if (item.start < parent.start)
            invalid(
              `${path}.${item.id}.start`,
              `must not be before dependency ${dependency} starts`,
            );
          continue;
        }
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
      const startAfter = normalizeStartAfter(source.startAfter, dependsOn, `${path}.startAfter`);
      const ref = refValue(source.ref, `${path}.ref`);
      const record = { id, projectId, title, description, progress, start, end, values, dependsOn };
      // Only an activity that overlaps another carries the field.
      if (Object.keys(startAfter).length) record.startAfter = startAfter;
      if (ref) record.ref = ref;
      return record;
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

  // Board rows and columns and timeline grouping may also be the assignee.
  function normalizeAxisReference(value, validIds, path) {
    if (value === ASSIGNEE_AXIS) return value;
    if (value === undefined || value === '') return '';
    if (typeof value !== 'string' || !validIds.has(value))
      invalid(path, `must reference a manifest dimension, be "${ASSIGNEE_AXIS}" or be empty`);
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
    const columnKeys = new Set(['title', 'duration', 'start', 'end', 'dependsOn', ...dimensions]);
    return views.map((view, index) => {
      const path = `sharedViews[${index}]`;
      const source = requireRecord(view, path);
      const id = registry.add(source.id, `${path}.id`);
      const projectId = ownerValue(source.projectId, context, `${path}.projectId`);
      const name = stringValue(source.name, `${path}.name`, 100, true);
      const mode = source.view === undefined ? 'grid' : source.view;
      if (!VIEWS.has(mode)) invalid(`${path}.view`, 'must be grid, timeline, list, or flow');
      const row = normalizeAxisReference(source.row, dimensions, `${path}.row`);
      const col = normalizeAxisReference(source.col, dimensions, `${path}.col`);
      const color = normalizeDimensionReference(source.color, dimensions, `${path}.color`);
      const flowGroup = normalizeDimensionReference(
        source.flowGroup,
        dimensions,
        `${path}.flowGroup`,
      );
      const group = normalizeAxisReference(source.group, dimensions, `${path}.group`);
      const timelineSummarizeBy = normalizeDimensionReference(
        source.timelineSummarizeBy,
        dimensions,
        `${path}.timelineSummarizeBy`,
      );
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
        timelineWeekNumbers: booleanValue(
          source.timelineWeekNumbers,
          `${path}.timelineWeekNumbers`,
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
        flowHideDates: booleanValue(source.flowHideDates, `${path}.flowHideDates`, false),
        showAssignee: booleanValue(source.showAssignee, `${path}.showAssignee`, true),
        showRefs: booleanValue(source.showRefs, `${path}.showRefs`, false),
        timelineActivityRows,
        hideTimelineLabels,
        timelineMilestoneMode,
        timelineMilestonesBesideWork: booleanValue(
          source.timelineMilestonesBesideWork,
          `${path}.timelineMilestonesBesideWork`,
          false,
        ),
        timelineSummarizeBy,
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

  // A reference key is free text a person may change at any time; an empty
  // one is left out of the record.
  function refValue(value, path) {
    return value === undefined ? '' : stringValue(value, path, MAX_REF_LENGTH, false);
  }

  /*
   * The prefix a project's reference keys start with, from its name: the
   * initials of two or three words, otherwise the first two letters. Letters
   * fold to A–Z and anything else is left out, so a name without Latin
   * letters gives no prefix.
   */
  function refPrefixFromName(name) {
    const fold = (text) =>
      String(text ?? '')
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .replace(/[ßẞ]/g, 'SS')
        .replace(/[ÆæǼǽ]/g, 'AE')
        .replace(/[Œœ]/g, 'OE')
        .replace(/[Øø]/g, 'O')
        .replace(/[Łł]/g, 'L')
        .replace(/[ĐđÐð]/g, 'D')
        .replace(/[Þþ]/g, 'TH')
        .replace(/ı/g, 'I')
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
    const words = String(name ?? '')
      .split(/\s+/)
      .map(fold)
      .filter(Boolean);
    const prefix =
      words.length === 2 || words.length === 3
        ? words.map((word) => word[0]).join('')
        : fold(name).slice(0, 2);
    return REF_PREFIX_PATTERN.test(prefix) ? prefix : '';
  }

  /*
   * The next reference key with `prefix`: one more than the highest number
   * any activity or milestone already uses with it, so keys are never reused
   * while their records remain. Without a prefix there is none.
   */
  function nextRef(project, prefix = project?.manifest?.refPrefix || '') {
    if (!prefix) return '';
    const pattern = new RegExp(`^${prefix}-(\\d{1,9})$`, 'i');
    let highest = 0;
    for (const record of [...(project.items || []), ...(project.milestones || [])]) {
      const match = pattern.exec(String(record.ref || '').trim());
      if (match) highest = Math.max(highest, Number(match[1]));
    }
    return `${prefix}-${highest + 1}`;
  }

  /* The IDs of activities and milestones whose key another record also has. */
  function duplicateRefs(project) {
    const owners = new Map();
    for (const record of [...(project?.items || []), ...(project?.milestones || [])]) {
      const key = String(record.ref || '')
        .trim()
        .toUpperCase();
      if (!key) continue;
      owners.set(key, [...(owners.get(key) || []), record.id]);
    }
    return new Set([...owners.values()].filter((ids) => ids.length > 1).flat());
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
      const ref = refValue(source.ref, `${path}.ref`);
      return { id, projectId, title, date, dependsOn, fixed, ...(ref ? { ref } : {}) };
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
   * the conflict copy that keeps another device's version of a document. Every
   * record's `projectId` follows the manifest; record IDs are
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

  /**
   * Whether a view shows an activity: every set filter matches and the
   * search finds its text in the activity's reference key, title,
   * description or dimension values. The editor, screens and
   * screen-link snapshots share this test.
   */
  function activityMatcher({ filters = {}, query = '' } = {}, dimensions = [], locale) {
    const set = Object.entries(filters || {}).filter(([, option]) => option);
    const search = String(query || '').toLocaleLowerCase(locale);
    const names = dimensions.map((dimension) => [
      dimension.id,
      new Map(dimension.options.map((choice) => [choice.id, choice.name])),
    ]);
    return (item) =>
      set.every(([dimension, option]) => item.values[dimension] === option) &&
      (!search ||
        (
          (item.ref ? `${item.ref} ` : '') +
          item.title +
          ' ' +
          item.description +
          ' ' +
          names.map(([id, options]) => options.get(item.values[id]) || '').join(' ')
        )
          .toLocaleLowerCase(locale)
          .includes(search));
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
  const CALENDAR_METADATA_VERSION = 2;
  const CALENDAR_METADATA_SECTIONS = new Set(['manifest', 'view', 'dimension']);

  function exactKeys(value, expected, path) {
    const actual = Object.keys(value).sort();
    const keys = expected.slice().sort();
    if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index]))
      invalid(path, 'contains unsupported fields');
  }

  function oneRecord(records, recordId, path) {
    const matches = recordId ? records.filter((record) => record.id === recordId) : records;
    if (matches.length !== 1) invalid(path, 'must identify exactly one record');
    return matches[0];
  }

  /*
   * The Notes envelope of a calendar metadata event. The manifest
   * event holds the manifest without its dimensions; each dimension and each
   * shared view owns an event. Record order lives in each event's URL rank.
   */
  function serializeCalendarMetadata(project, section, recordId) {
    const normalized = normalizeProject(project);
    let payload;
    if (section === 'manifest') {
      const { dimensions: _dimensions, ...manifest } = JSON.parse(
        serializeManifest(normalized.manifest),
      );
      payload = { manifest };
    } else if (section === 'view') {
      const view = oneRecord(normalized.sharedViews, recordId, 'viewId');
      payload = { view: JSON.parse(serializeViews([view], normalized.manifest))[0] };
    } else if (section === 'dimension') {
      payload = {
        dimension: JSON.parse(
          JSON.stringify(oneRecord(normalized.manifest.dimensions, recordId, 'dimensionId')),
        ),
      };
    } else {
      invalid('section', 'must be manifest, view or dimension');
    }
    return JSON.stringify({
      format: CALENDAR_METADATA_FORMAT,
      version: CALENDAR_METADATA_VERSION,
      section,
      payload,
    });
  }

  /**
   * The payload of a calendar Notes envelope: `{ manifest }` with empty
   * `dimensions`, `{ dimension }` or `{ view }`. A view needs the manifest
   * with its dimensions as context.
   */
  function deserializeCalendarMetadata(value, section, contextInput) {
    const source = requireRecord(parseJsonInput(value, 'calendarMetadata'), 'calendarMetadata');
    exactKeys(source, ['format', 'version', 'section', 'payload'], 'calendarMetadata');
    if (source.format !== CALENDAR_METADATA_FORMAT)
      invalid('calendarMetadata.format', 'unsupported');
    if (source.version !== CALENDAR_METADATA_VERSION)
      invalid('calendarMetadata.version', 'unsupported');
    if (!CALENDAR_METADATA_SECTIONS.has(section))
      invalid('section', 'must be manifest, view or dimension');
    if (source.section !== section) invalid('calendarMetadata.section', 'unexpected section');
    const payload = requireRecord(source.payload, 'calendarMetadata.payload');
    exactKeys(payload, [section], 'calendarMetadata.payload');
    if (section === 'manifest') {
      const manifest = requireRecord(payload.manifest, 'calendarMetadata.payload.manifest');
      if (hasOwn(manifest, 'dimensions'))
        invalid('calendarMetadata.payload.manifest.dimensions', 'belong to dimension events');
      return { manifest: deserializeManifest({ ...manifest, dimensions: [] }) };
    }
    if (section === 'dimension') {
      const [dimension] = normalizeDimensions(
        [payload.dimension],
        makeIdRegistry(),
        'calendarMetadata.payload.dimension',
      );
      return { dimension };
    }
    const views = deserializeViews(JSON.stringify([payload.view]), contextInput);
    return { view: views[0] };
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
    assigneeAxis: ASSIGNEE_AXIS,
    enumValues: ENUM_VALUES,
    renamedViewValues: RENAMED_VIEW_VALUES,
    workCalendar,
    startThreshold,
    maxRefLength: MAX_REF_LENGTH,
    refPrefixFromName,
    nextRef,
    duplicateRefs,
    normalizeProject,
    copyAsNewProject,
    activityMatcher,
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
/* Read-time repair of references that a store settled record by record left
 * broken. A calendar keeps the last writer of each event, so a
 * project read from it can hold a value for an option another device
 * removed, a dependency on a deleted record, a dependency cycle from two
 * offline edits, or a successor that starts before its moved predecessor
 * ends. The repair drops what points at nothing, breaks cycles and moves
 * successors later; it never removes a record. Pure: no storage or clocks.
 */
(function installProjectRepair(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.tidigarProjectRepair = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function projectRepairModule() {
  'use strict';

  const DAY = 86400000;
  const LAST_DAY = Date.parse('2200-12-31T00:00:00Z');
  const VIEW_DIMENSIONS = ['row', 'col', 'color', 'flowGroup', 'group'];

  const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const list = (value) => (Array.isArray(value) ? value.filter(isRecord) : []);
  const parse = (value) =>
    typeof value === 'string' ? Date.parse(`${value}T00:00:00Z`) : Number.NaN;
  const iso = (time) => new Date(time).toISOString().slice(0, 10);

  function createFactory({ model }) {
    /**
     * Return `{ project, repairs }`: the normalized project and, in record
     * order, `{ collection, id, fields }` for each record the repair changed.
     * Whatever the repair does not cover still fails normalization.
     * `datesOnly` preserves references and valid overlaps for share links;
     * it moves only dates that violate the stored dependency contract.
     */
    function repairProject(value, { datesOnly = false } = {}) {
      const source = JSON.parse(JSON.stringify(value));
      if (!isRecord(source)) return { project: model.normalizeProject(source), repairs: [] };
      const changed = new Map();
      const mark = (collection, id, field) => {
        const key = `${collection}:${id}`;
        if (!changed.has(key)) changed.set(key, { collection, id, fields: [] });
        const entry = changed.get(key);
        if (!entry.fields.includes(field)) entry.fields.push(field);
      };

      const manifest = isRecord(source.manifest) ? source.manifest : {};
      const options = new Map(
        list(manifest.dimensions).map((dimension) => [
          dimension.id,
          new Set(list(dimension.options).map((option) => option.id)),
        ]),
      );
      const items = list(source.items);
      const milestones = list(source.milestones);

      const byId = new Map(items.map((item) => [item.id, item]));
      const fixed = new Map(
        milestones.filter((point) => point.fixed === true).map((point) => [point.id, point]),
      );

      if (!datesOnly) {
        // A value for an option its dimension no longer has.
        for (const item of items) {
          if (!isRecord(item.values)) continue;
          for (const [dimensionId, optionId] of Object.entries(item.values)) {
            const known = options.get(dimensionId);
            if (!known || optionId === '' || known.has(optionId)) continue;
            delete item.values[dimensionId];
            mark('items', item.id, 'values');
          }
        }
        // A saved view arranged by a dimension that is gone.
        for (const view of list(source.sharedViews))
          for (const field of VIEW_DIMENSIONS)
            if (
              typeof view[field] === 'string' &&
              view[field] &&
              !options.has(view[field]) &&
              !(view[field] === 'assignee' && ['row', 'col', 'group'].includes(field))
            ) {
              view[field] = '';
              mark('sharedViews', view.id, field);
            }

        // Dependencies on records that are gone, or on a milestone that is no
        // longer fixed.
        const keep = (record, collection, allowed) => {
          if (!Array.isArray(record.dependsOn)) return;
          const kept = record.dependsOn.filter(allowed);
          if (kept.length === record.dependsOn.length) return;
          record.dependsOn = kept;
          mark(collection, record.id, 'dependsOn');
        };
        for (const item of items) keep(item, 'items', (id) => byId.has(id) || fixed.has(id));
        for (const point of milestones)
          if (point.fixed !== true) keep(point, 'milestones', (id) => byId.has(id));
      }

      // Two offline edits can close a cycle. Walking in record order, which
      // every device shares, drops the dependency that closes it.
      const order = [];
      const state = new Map();
      const visit = (item) => {
        state.set(item.id, 'visiting');
        if (Array.isArray(item.dependsOn))
          for (const id of [...item.dependsOn]) {
            const parent = byId.get(id);
            if (!parent || state.get(id) === 'done') continue;
            if (state.get(id) === 'visiting') {
              if (datesOnly) continue;
              item.dependsOn = item.dependsOn.filter((dependency) => dependency !== id);
              mark('items', item.id, 'dependsOn');
            } else visit(parent);
          }
        state.set(item.id, 'done');
        order.push(item);
      };
      for (const item of items) if (!state.has(item.id)) visit(item);

      if (!datesOnly) {
        // Overlaps outlive neither their dependency nor a predecessor that
        // became a fixed milestone.
        for (const item of items) {
          if (!item.startAfter || typeof item.startAfter !== 'object') continue;
          const dependsOn = Array.isArray(item.dependsOn) ? item.dependsOn : [];
          const kept = Object.fromEntries(
            Object.entries(item.startAfter).filter(
              ([id]) => dependsOn.includes(id) && byId.has(id),
            ),
          );
          if (Object.keys(kept).length === Object.keys(item.startAfter).length) continue;
          if (Object.keys(kept).length) item.startAfter = kept;
          else delete item.startAfter;
          mark('items', item.id, 'startAfter');
        }
      }

      // What starts before what it waits for has ended moves later, keeping
      // its length, as an edit would.
      const calendar =
        manifest.schedule === 'work-days'
          ? model.workCalendar(list(source.periodIndicators))
          : null;
      const earliest = (item, id) => {
        if (fixed.has(id)) return parse(fixed.get(id).date);
        const percent = item.startAfter?.[id];
        if (percent === undefined) return parse(byId.get(id)?.end) + DAY;
        const parent = byId.get(id);
        if (datesOnly) return parse(parent?.start);
        if (!Number.isFinite(parse(parent.start)) || !Number.isFinite(parse(parent.end)))
          return NaN;
        return model.startThreshold(parent, percent, calendar);
      };
      for (const item of order) {
        const start = parse(item.start);
        const end = parse(item.end);
        const parents = Array.isArray(item.dependsOn)
          ? item.dependsOn.map((id) => earliest(item, id))
          : [];
        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          end < start ||
          !parents.every(Number.isFinite)
        )
          continue;
        const minimum = Math.max(...parents, start);
        if (minimum === start) continue;
        let nextStart = minimum;
        let nextEnd = end + (minimum - start);
        if (calendar) {
          nextStart = calendar.firstWorkDay(minimum);
          nextEnd = calendar.lastWorkDay(nextStart, calendar.durationOf(start, end));
        }
        if (nextEnd > LAST_DAY) continue;
        item.start = iso(nextStart);
        item.end = iso(nextEnd);
        mark('items', item.id, 'start');
      }
      for (const point of milestones) {
        if (point.fixed === true || !Array.isArray(point.dependsOn)) continue;
        const date = parse(point.date);
        const parents = point.dependsOn.map((id) => parse(byId.get(id)?.end) + DAY);
        if (!Number.isFinite(date) || !parents.every(Number.isFinite)) continue;
        const minimum = Math.max(...parents, date);
        if (minimum === date || minimum > LAST_DAY) continue;
        point.date = iso(minimum);
        mark('milestones', point.id, 'date');
      }

      return { project: model.normalizeProject(source), repairs: [...changed.values()] };
    }

    return Object.freeze({ repairProject });
  }

  return Object.freeze({ createFactory });
});
})(scope);
(function (globalThis) {
/* Lenient reading of a share link that a person or an AI agent wrote by
 * hand. Values that are plainly meant, such as an ISO date for a day offset,
 * an option's name for its number or `#3366CC` for a color, are rewritten in
 * the link's own form; what breaks a rule but has an obvious fix, such as a
 * too-long title or a dependency on nothing, is fixed. Every correction is
 * reported in English, by the record's place in the link, so the reader can
 * hand the list to whoever made the link. What has no obvious fix still
 * fails with a message that names the place. Pure: no storage or clocks
 * except the current year when a link names none.
 */
(function installShareLinkTidy(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.tidigarShareLinkTidy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function shareLinkTidyModule() {
  'use strict';

  const DAY = 86400000;
  const PROGRESS = [0, 25, 50, 75, 100];
  const PALETTE = ['4f7cff', '20a37a', 'e0a100', 'd94f70', '8a5cf6', '1aa3c7', 'f07a2a', '6b7280'];
  const NAMED_COLORS = {
    black: '000000',
    white: 'ffffff',
    gray: '808080',
    grey: '808080',
    red: 'e5484d',
    orange: 'f07a2a',
    yellow: 'e0a100',
    green: '20a37a',
    teal: '12a594',
    cyan: '1aa3c7',
    blue: '4f7cff',
    indigo: '5b5bd6',
    purple: '8a5cf6',
    violet: '8a5cf6',
    pink: 'd94f70',
    brown: '9a6b4f',
  };
  const DIMENSION_FIELDS = ['row', 'col', 'color', 'group', 'flowGroup', 'timelineSummarizeBy'];
  // View names as people write them, in English and the app's languages.
  const VIEW_NAMES = new Map(
    Object.entries({
      timeline: [
        'timeline',
        'gantt',
        'tidslinje',
        'zeitleiste',
        'zeitachse',
        'chronologie',
        'frise',
        'cronología',
        'línea de tiempo',
        'linea temporale',
        'cronologia',
        'tijdlijn',
        'aikajana',
        'oś czasu',
        'linha do tempo',
        'tidslinjen',
        'roadmap',
      ],
      grid: [
        'grid',
        'board',
        'kanban',
        'tavla',
        'rutnät',
        'tavle',
        'rutenett',
        'tafel',
        'raster',
        'tableau',
        'tablero',
        'quadro',
        'taulu',
        'tablica',
        'bord',
      ],
      list: [
        'list',
        'table',
        'lista',
        'tabell',
        'liste',
        'tabelle',
        'tableau liste',
        'lijst',
        'luettelo',
        'elenco',
        'tabla',
      ],
      flow: [
        'flow',
        'flowchart',
        'flöde',
        'flyt',
        'fluss',
        'flux',
        'flujo',
        'flusso',
        'stroom',
        'kulku',
        'przepływ',
        'fluxo',
        'network',
        'graph',
      ],
    }).flatMap(([view, names]) => names.map((name) => [name, view])),
  );

  const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const show = (value) => {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : text.length > 40 ? `${text.slice(0, 40)}…` : text;
  };
  const sameText = (left, right) =>
    typeof left === 'string' &&
    typeof right === 'string' &&
    left.trim().toLocaleLowerCase('en') === right.trim().toLocaleLowerCase('en');

  /* `repairProject` is the project repair's (`project-repair.js`). */
  function createFactory({ model, repairProject }) {
    /**
     * Return `{ payload, corrections }`: a copy of a link's payload with
     * plainly meant values rewritten, and a sentence for each change. Throws
     * an Error naming the place for a value it cannot read.
     */
    function tidyPayload(input) {
      const corrections = [];
      if (!isRecord(input)) throw Error('The share link holds no roadmap object.');
      const payload = JSON.parse(JSON.stringify(input));
      const note = (where, text) => corrections.push(`${where}: ${text}`);
      const failAt = (where, text) => {
        throw Error(`${where}: ${text}`);
      };
      const label = (key, index, title) =>
        typeof title === 'string' && title.trim()
          ? `${key}[${index}] ${show(title.length > 40 ? `${title.slice(0, 40)}…` : title)}`
          : `${key}[${index}]`;

      // Lists: an object of records becomes its values; a lone record a list.
      const asList = (key, where) => {
        const value = payload[key];
        if (value === undefined || value === null) {
          if (value === null) note(where, 'null was read as an empty list');
          return [];
        }
        if (Array.isArray(value)) return value;
        failAt(where, `expected a list, found ${show(value)}`);
      };

      // Year: a year written as text or a date, or found in the first ISO
      // date of the link, or the current year.
      const isoDates = [];
      JSON.stringify(payload, (key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) isoDates.push(value);
        return value;
      });
      let year = payload.y;
      if (typeof year === 'string' && /^\s*\d{4}(-|\s*$)/.test(year))
        year = Number(year.trim().slice(0, 4));
      if (!Number.isInteger(year) || year < 1900 || year > 2200) {
        const found = isoDates
          .map((date) => Number(date.slice(0, 4)))
          .find((value) => value >= 1900 && value <= 2200);
        const fallback = found ?? new Date().getUTCFullYear();
        note(
          'y',
          `${payload.y === undefined ? 'missing year' : `year ${show(payload.y)}`} became ${fallback}`,
        );
        year = fallback;
      } else if (year !== payload.y) note('y', `year ${show(payload.y)} became ${year}`);
      payload.y = year;
      const base = Date.UTC(year, 0, 1) / DAY;

      // A day offset from January 1 of `y`, written as a number, numeric text
      // or an ISO date.
      const dayOf = (value, where, field) => {
        if (Number.isSafeInteger(value)) return value;
        if (typeof value === 'number' && Number.isFinite(value)) {
          note(where, `${field} ${value} was rounded to ${Math.round(value)}`);
          return Math.round(value);
        }
        if (typeof value === 'string') {
          const text = value.trim();
          if (/^-?\d+(\.\d+)?$/.test(text)) {
            note(
              where,
              `${field} ${show(value)} was read as the number ${Math.round(Number(text))}`,
            );
            return Math.round(Number(text));
          }
          const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+Z?)?$/.exec(text);
          const time = match ? Date.UTC(+match[1], +match[2] - 1, +match[3]) : NaN;
          if (
            Number.isFinite(time) &&
            new Date(time).toISOString().slice(0, 10) === `${match[1]}-${match[2]}-${match[3]}`
          ) {
            const offset = time / DAY - base;
            note(
              where,
              `${field} ${show(value)} was read as day ${offset} from January 1, ${year}`,
            );
            return offset;
          }
        }
        failAt(where, `${field} ${show(value)} is not a day offset from January 1 of y`);
      };
      const lengthOf = (start, value, where) => {
        if (value === undefined || value === null) {
          note(where, 'missing length became 0, a single day');
          return 0;
        }
        let length;
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim()))
          length = dayOf(value, where, 'end') - start;
        else length = dayOf(value, where, 'length');
        if (length < 0) {
          note(where, `negative length ${length} became 0`);
          return 0;
        }
        return length;
      };
      const textOf = (value, where, field, max, fallback = '') => {
        let text = value;
        if (text === undefined || text === null) text = '';
        else if (typeof text === 'number' || typeof text === 'boolean') {
          text = String(text);
          note(where, `${field} ${show(value)} was read as text`);
        } else if (typeof text !== 'string') {
          note(where, `${field} ${show(value)} is not text and was left out`);
          text = '';
        }
        if (fallback && !text.trim()) {
          note(where, `empty ${field} became ${show(fallback)}`);
          return fallback;
        }
        if (text.length > max) {
          note(where, `${field} was shortened to ${max} characters`);
          return text.slice(0, max);
        }
        return text;
      };
      let colors = 0;
      const colorOf = (value, where, field = 'color') => {
        const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
        let hex = text.replace(/^#/, '');
        if (/^[0-9a-f]{3}$/.test(hex)) hex = [...hex].map((digit) => digit + digit).join('');
        if (NAMED_COLORS[hex]) hex = NAMED_COLORS[hex];
        if (/^[0-9a-f]{6}$/.test(hex)) {
          if (typeof value === 'string' && /^[0-9a-f]{6}$/i.test(value)) return value;
          note(where, `${field} ${show(value)} became ${show(hex)}`);
          return hex;
        }
        const fallback = PALETTE[colors++ % PALETTE.length];
        note(
          where,
          value === undefined
            ? `missing ${field} became ${show(fallback)}`
            : `${field} ${show(value)} is not six hexadecimal digits; used ${show(fallback)}`,
        );
        return fallback;
      };
      const flag = (value, where, field, fallback) => {
        if (value === undefined) return undefined;
        if (value === 0 || value === 1) return value;
        const read =
          value === true || value === 'true' || value === '1'
            ? 1
            : value === false || value === 'false' || value === '0'
              ? 0
              : fallback;
        note(where, `${field} ${show(value)} became ${read}`);
        return read;
      };
      const fromObject = (entry, fields) =>
        isRecord(entry) ? fields.map((field) => entry[field]) : entry;

      // The dimensions and their options.
      const dimensions = asList('m', 'm').map((rawEntry, index) => {
        let entry = rawEntry;
        if (isRecord(entry)) entry = [entry.name, entry.options];
        const where = label('m', index, Array.isArray(entry) ? entry[0] : undefined);
        if (!Array.isArray(entry))
          failAt(where, `expected [name, options], found ${show(rawEntry)}`);
        const name = textOf(entry[0], where, 'name', 100);
        const options = (Array.isArray(entry[1]) ? entry[1] : []).map((rawChoice, position) => {
          let choice = rawChoice;
          if (isRecord(choice)) choice = [choice.name, choice.color];
          if (typeof choice === 'string') choice = [choice];
          const at = `${where} option ${position + 1}`;
          if (!Array.isArray(choice))
            failAt(at, `expected [name, color], found ${show(rawChoice)}`);
          return [textOf(choice[0], at, 'name', 100), colorOf(choice[1], at)];
        });
        if (entry[1] !== undefined && !Array.isArray(entry[1]))
          note(where, `options ${show(entry[1])} are not a list and were left out`);
        return [name, options];
      });
      if (payload.m !== undefined) payload.m = dimensions;

      // An option number, or an option's name.
      const optionOf = (dimension, value, where) => {
        if (value === undefined || value === null || value === '') return 0;
        if (Number.isInteger(value) && value >= 0 && value <= dimension[1].length) return value;
        const position = dimension[1].findIndex(([name]) => sameText(name, String(value)));
        if (position >= 0) {
          if (value !== position + 1)
            note(
              where,
              `option ${show(value)} of ${show(dimension[0])} became its number ${position + 1}`,
            );
          return position + 1;
        }
        if (typeof value === 'string' && /^\d+$/.test(value.trim()))
          return optionOf(dimension, Number(value), where);
        note(where, `${show(dimension[0])} has no option ${show(value)}; it was left empty`);
        return 0;
      };

      const rawItems = asList('i', 'i');
      const rawMilestones = asList('s', 's');
      const titleOf = (entry) =>
        Array.isArray(entry) ? entry[0] : isRecord(entry) ? entry.title : undefined;
      const fixedOf = (entry) => {
        const value = Array.isArray(entry) ? entry[3] : isRecord(entry) ? entry.fixed : undefined;
        return value === 1 || value === true || value === '1' || value === 'true';
      };
      // A predecessor index, or the title of an activity or a milestone.
      const reference = (value, where, allowMilestones) => {
        const count = allowMilestones ? rawItems.length + rawMilestones.length : rawItems.length;
        if (Number.isInteger(value) && value >= 0 && value < count) return value;
        if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
          const index = Number(value.trim());
          if (index < count) return index;
        }
        if (typeof value === 'string') {
          const activity = rawItems.findIndex((entry) => sameText(titleOf(entry), value));
          if (activity >= 0) {
            note(where, `dependency ${show(value)} became activity index ${activity}`);
            return activity;
          }
          const milestone = allowMilestones
            ? rawMilestones.findIndex((entry) => sameText(titleOf(entry), value))
            : -1;
          if (milestone >= 0) {
            note(where, `dependency ${show(value)} became index ${rawItems.length + milestone}`);
            return rawItems.length + milestone;
          }
        }
        note(where, `dependency ${show(value)} refers to nothing and was removed`);
        return null;
      };
      const shareOf = (value, where) => {
        if (value === undefined || value === null) return 100;
        let share = typeof value === 'string' ? Number(value.replace('%', '').trim()) : value;
        if (typeof share === 'number' && share > 0 && share < 1) share *= 100;
        if (typeof share !== 'number' || !Number.isFinite(share)) {
          note(where, `start-after share ${show(value)} became 100`);
          return 100;
        }
        const nearest = PROGRESS.reduce((best, step) =>
          Math.abs(step - share) < Math.abs(best - share) ? step : best,
        );
        if (nearest !== value) note(where, `start-after share ${show(value)} became ${nearest}`);
        return nearest;
      };

      payload.i = rawItems.map((rawEntry, index) => {
        const entry = fromObject(rawEntry, [
          'title',
          'start',
          'length',
          'description',
          'progress',
          'values',
          'dependsOn',
          'startAfter',
          'ref',
        ]);
        const where = `activity ${label('i', index, titleOf(rawEntry))}`;
        if (!Array.isArray(entry))
          failAt(where, `expected an activity tuple, found ${show(rawEntry)}`);
        if (isRecord(rawEntry)) {
          note(where, 'an activity object became a tuple');
          if (rawEntry.end !== undefined && rawEntry.length === undefined) entry[2] = rawEntry.end;
        }
        const title = textOf(entry[0], where, 'title', 180);
        const start = dayOf(entry[1], where, 'start');
        const length = lengthOf(start, entry[2], where);
        const description = textOf(entry[3], where, 'description', 12000);
        let progress = entry[4] === undefined || entry[4] === null ? 0 : entry[4];
        if (!PROGRESS.includes(progress)) {
          let value =
            typeof progress === 'string' ? Number(progress.replace('%', '').trim()) : progress;
          if (typeof value === 'number' && value > 0 && value < 1) value *= 100;
          if (typeof value !== 'number' || !Number.isFinite(value)) value = 0;
          value = Math.min(100, Math.max(0, value));
          const nearest = PROGRESS.reduce((best, step) =>
            Math.abs(step - value) < Math.abs(best - value) ? step : best,
          );
          note(where, `progress ${show(progress)} became ${nearest}`);
          progress = nearest;
        }
        let values = entry[5];
        if (values === undefined || values === null) values = [];
        if (isRecord(values)) {
          const byDimension = values;
          values = dimensions.map((dimension, position) => {
            const key = Object.keys(byDimension).find(
              (name) => name === String(position) || sameText(name, dimension[0]),
            );
            return key === undefined ? 0 : byDimension[key];
          });
          note(where, 'values given by dimension became a list in dimension order');
        }
        if (!Array.isArray(values)) {
          note(where, `values ${show(values)} are not a list and were left out`);
          values = [];
        }
        if (values.length > dimensions.length) {
          note(
            where,
            `${values.length - dimensions.length} values beyond the dimensions were removed`,
          );
          values = values.slice(0, dimensions.length);
        }
        values = values.map((value, position) => optionOf(dimensions[position], value, where));
        let dependsOn = entry[6];
        if (dependsOn === undefined || dependsOn === null) dependsOn = [];
        if (!Array.isArray(dependsOn)) dependsOn = [dependsOn];
        let parts = entry[7];
        if (parts === undefined || parts === null) parts = [];
        if (!Array.isArray(parts)) parts = [parts];
        if (parts.length > dependsOn.length) {
          note(where, 'start-after shares beyond its dependencies were removed');
          parts = parts.slice(0, dependsOn.length);
        }
        const kept = [];
        const keptParts = [];
        dependsOn.forEach((value, position) => {
          const predecessor = reference(value, where, true);
          if (predecessor === null) return;
          if (predecessor === index) {
            note(where, 'a dependency on itself was removed');
            return;
          }
          if (kept.includes(predecessor)) {
            note(where, `a repeated dependency on ${predecessor} was removed`);
            return;
          }
          const milestone = predecessor >= rawItems.length;
          if (milestone && !fixedOf(rawMilestones[predecessor - rawItems.length])) {
            note(
              where,
              `a dependency on milestone ${predecessor}, which is not fixed, was removed`,
            );
            return;
          }
          let share = shareOf(parts[position], where);
          if (milestone && share !== 100) {
            note(where, 'a fixed milestone always has start-after share 100');
            share = 100;
          }
          kept.push(predecessor);
          keptParts.push(share);
        });
        while (keptParts.length && keptParts[keptParts.length - 1] === 100) keptParts.pop();
        const ref = textOf(entry[8], where, 'key', 32);
        return [title, start, length, description, progress, values, kept, keptParts, ref];
      });

      payload.s = rawMilestones.map((rawEntry, index) => {
        const entry = fromObject(rawEntry, ['title', 'date', 'dependsOn', 'fixed', 'ref']);
        const where = `milestone ${label('s', index, titleOf(rawEntry))}`;
        if (!Array.isArray(entry))
          failAt(where, `expected a milestone tuple, found ${show(rawEntry)}`);
        if (isRecord(rawEntry)) note(where, 'a milestone object became a tuple');
        const title = textOf(entry[0], where, 'title', 180, 'Milestone');
        const date = dayOf(entry[1], where, 'date');
        const fixed = flag(entry[3], where, 'fixed', 0) ?? 0;
        let dependsOn = entry[2];
        if (dependsOn === undefined || dependsOn === null) dependsOn = [];
        if (!Array.isArray(dependsOn)) dependsOn = [dependsOn];
        if (fixed === 1 && dependsOn.length) {
          note(where, 'a fixed milestone has no dependencies; they were removed');
          dependsOn = [];
        }
        const kept = [];
        for (const value of dependsOn) {
          const predecessor = reference(value, where, false);
          if (predecessor === null) continue;
          if (kept.includes(predecessor))
            note(where, `a repeated dependency on ${predecessor} was removed`);
          else kept.push(predecessor);
        }
        return [title, date, kept, fixed, textOf(entry[4], where, 'key', 32)];
      });

      payload.p = asList('p', 'p').map((rawEntry, index) => {
        const entry = fromObject(rawEntry, ['title', 'start', 'length', 'color', 'vacation']);
        const where = `period ${label('p', index, titleOf(rawEntry))}`;
        if (!Array.isArray(entry))
          failAt(where, `expected a period tuple, found ${show(rawEntry)}`);
        if (isRecord(rawEntry)) {
          note(where, 'a period object became a tuple');
          if (rawEntry.end !== undefined && rawEntry.length === undefined) entry[2] = rawEntry.end;
        }
        const title = textOf(entry[0], where, 'title', 180, 'Period');
        const start = dayOf(entry[1], where, 'start');
        return [
          title,
          start,
          lengthOf(start, entry[2], where),
          colorOf(entry[3], where),
          flag(entry[4], where, 'vacation', 1) ?? 1,
        ];
      });
      for (const key of ['i', 's', 'p']) if (!payload[key].length) delete payload[key];

      payload.n = textOf(payload.n, 'n', 'name', 100, 'Roadmap');
      if (payload.d !== undefined) payload.d = textOf(payload.d, 'd', 'description', 500);
      if (payload.w !== undefined && payload.w !== 1) {
        const read = flag(payload.w, 'w', 'work days', 0);
        if (read === 1) payload.w = 1;
        else delete payload.w;
      }
      if (payload.r !== undefined) {
        const prefix = typeof payload.r === 'string' ? payload.r.trim().toUpperCase() : '';
        if (/^[A-Z][A-Z0-9]{0,9}$/.test(prefix)) {
          if (prefix !== payload.r)
            note('r', `key prefix ${show(payload.r)} became ${show(prefix)}`);
          payload.r = prefix;
        } else {
          note(
            'r',
            `key prefix ${show(payload.r)} is not up to 10 capital letters and digits; it was left out`,
          );
          delete payload.r;
        }
      }
      if (payload.c !== undefined) {
        const time = typeof payload.c === 'string' ? Date.parse(payload.c) : NaN;
        // A date that does not exist, such as February 30, is not rolled over.
        const instant =
          Number.isFinite(time) &&
          !(
            /^\d{4}-\d{2}-\d{2}/.test(payload.c) &&
            new Date(time).toISOString().slice(0, 10) !== payload.c.slice(0, 10)
          )
            ? new Date(time).toISOString().replace(/\.\d{3}Z$/, 'Z')
            : '';
        if (!instant) {
          note('c', `creation time ${show(payload.c)} is not a date and time; it was left out`);
          delete payload.c;
        } else if (instant !== payload.c) {
          note('c', `creation time ${show(payload.c)} became ${instant}`);
          payload.c = instant;
        }
      }

      // Views: a dimension by its name, and a view mode by its name in a
      // language Tidigar speaks.
      const readView = (view, where) => {
        for (const field of DIMENSION_FIELDS) {
          const value = view[field];
          if (value === undefined || value === '' || Number.isInteger(value)) continue;
          const index = dimensions.findIndex(([name]) => sameText(name, String(value)));
          const read = index >= 0 ? index : /^\d+$/.test(String(value).trim()) ? Number(value) : '';
          note(where, `${field} ${show(value)} became ${show(read)}`);
          view[field] = read;
        }
        for (const field of DIMENSION_FIELDS)
          if (
            Number.isInteger(view[field]) &&
            (view[field] < 0 || view[field] >= dimensions.length)
          ) {
            note(where, `${field} ${view[field]} names no dimension and was cleared`);
            view[field] = '';
          }
        if (
          typeof view.view === 'string' &&
          !['grid', 'timeline', 'list', 'flow'].includes(view.view)
        ) {
          const mode = VIEW_NAMES.get(view.view.trim().toLocaleLowerCase('en'));
          note(
            where,
            mode
              ? `view ${show(view.view)} became ${show(mode)}`
              : `view ${show(view.view)} is unknown and was left out`,
          );
          if (mode) view.view = mode;
          else delete view.view;
        }
        if (isRecord(view.filters))
          for (const [key, choice] of Object.entries(view.filters)) {
            const index = /^\d+$/.test(key)
              ? Number(key)
              : dimensions.findIndex(([name]) => sameText(name, key));
            delete view.filters[key];
            if (!dimensions[index]) {
              note(where, `filter ${show(key)} names no dimension and was removed`);
              continue;
            }
            if (String(index) !== key) note(where, `filter ${show(key)} became dimension ${index}`);
            view.filters[index] = optionOf(dimensions[index], choice, where);
          }
        for (const field of ['timelineStart', 'timelineEnd'])
          if (Number.isInteger(view[field])) {
            const date = new Date((base + view[field]) * DAY).toISOString().slice(0, 10);
            note(where, `${field} ${view[field]} became ${show(date)}`);
            view[field] = date;
          }
        return view;
      };
      if (payload.v !== undefined) {
        const views = asList('v', 'v');
        payload.v = views
          .map((view, index) => {
            const where = `view ${label('v', index, isRecord(view) ? view.name : undefined)}`;
            if (!isRecord(view)) {
              note(where, `${show(view)} is not a view object and was removed`);
              return null;
            }
            view.name = textOf(view.name, where, 'name', 100, `View ${index + 1}`);
            return readView(view, where);
          })
          .filter(Boolean);
        if (!payload.v.length) delete payload.v;
      }
      if (payload.o !== undefined) {
        if (isRecord(payload.o)) readView(payload.o, 'initial view o');
        else {
          note('initial view o', `${show(payload.o)} is not a view object and was left out`);
          delete payload.o;
        }
      }
      return { payload, corrections };
    }

    /* Saved views of an unpacked link that still fail validation lose the
       fields that fail, field by field, and at last the view itself. */
    function tidyViews(raw, names) {
      const corrections = [];
      raw.sharedViews = raw.sharedViews.filter((view, index) => {
        const where = names(index);
        const fixed = tidyView(view, raw.manifest, where, corrections);
        if (!fixed) corrections.push(`${where}: the view could not be read and was removed`);
        return fixed;
      });
      return corrections;
    }

    /* One unpacked view without the fields that fail validation. True when
       it validates; the view is changed in place. */
    function tidyView(view, manifest, where, corrections) {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
          model.normalizeViews([view], manifest);
          return true;
        } catch (error) {
          const message = String(error.message);
          const field = /^Invalid sharedViews\[0\]\.(\w+)/.exec(message)?.[1];
          if (field && field !== 'id' && field !== 'projectId' && field in view) {
            corrections.push(
              `${where}: ${field} ${show(view[field])} was left out (${message.replace(/^Invalid [^:]*: /, '')})`,
            );
            delete view[field];
          } else if (
            /start must not be after end/.test(message) &&
            ('timelineStart' in view || 'timelineEnd' in view)
          ) {
            corrections.push(`${where}: a timeline range that ends before it starts was left out`);
            delete view.timelineStart;
            delete view.timelineEnd;
          } else return false;
        }
      }
      return false;
    }

    /* What still fails validation after tidying: saved views lose what
       fails, then the project repair drops what points at nothing, breaks
       cycles and moves dates. `names` maps a record's ID to its place in
       the link. `{ project, repairs, corrections }`. */
    function repair(raw, names) {
      const corrections = tidyViews(raw, (index) => names.get(raw.sharedViews[index].id));
      const { project, repairs } = repairProject(raw);
      return {
        project,
        repairs,
        corrections: [
          ...corrections,
          ...repairs.flatMap(({ id, fields }) =>
            fields.map(
              (field) => `${names.get(id) ?? id}: ${REPAIRED[field] ?? `${field} was cleared`}`,
            ),
          ),
        ],
      };
    }

    return Object.freeze({ tidyPayload, tidyView, repair });
  }

  /* An English sentence for each kind of change the project repair makes. */
  const REPAIRED = {
    start: 'its dates were moved later to follow what it depends on',
    date: 'its date was moved later to follow what it depends on',
    dependsOn: 'a dependency that pointed at nothing or closed a cycle was removed',
    startAfter: 'a start-after share without its dependency was removed',
    values: 'a value for an option that does not exist was removed',
  };
  return Object.freeze({ createFactory });
});
})(scope);
(function (globalThis) {
/* Readable share links (`t=1~…`) that an AI agent writes by hand, without
 * code: records separated by `~`, referring to each other by key (`a3`,
 * `s1`) and to options and dimensions by name. Reading one gives the payload
 * of a compact link, with positions, day offsets and option numbers, for the
 * share-link reader to unpack, and a sentence for each problem, naming the
 * record. Records stand alone, so one mistake stays in its record. Pure.
 */
(function installReadableLink(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.tidigarReadableLink = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function readableLinkModule() {
  'use strict';

  const VERSION = '1';
  const DAY = 86400000;
  // The colors options get in order, since a readable link carries none.
  const COLORS = ['4f7cff', '16a34a', 'f59e0b', '8a52c1', '0891b2', 'dc5f5f', '64748b', 'db2777'];
  const PERIOD_COLOR = '9aa7b5';
  const VIEWS = { timeline: 'timeline', board: 'grid', grid: 'grid', list: 'list', flow: 'flow' };
  const VIEW_AXES = { rows: 'row', columns: 'col', color: 'color', group: 'group' };
  const KINDS = { a: 'activity', s: 'milestone', p: 'period' };
  // Words for how a timeline looks: `classic` is one activity per row under
  // a fixed label, as in MS Project, and opens in the Classic saved view a
  // new plan has; `compact` lets activities share rows; then the styles.
  const LAYOUTS = { classic: 'single-label', compact: 'compact' };
  const STYLES = ['minimal', 'airy', 'contrast', 'terminal'];

  const isReadable = (fragment) => /^#?t=/.test(String(fragment ?? ''));
  const same = (left, right) =>
    left.trim().toLocaleLowerCase('en') === right.trim().toLocaleLowerCase('en');

  // A field's text: `_` is a space and `%XX` an escaped character.
  function text(value) {
    const spaced = value.replace(/_/g, ' ');
    try {
      return decodeURIComponent(spaced);
    } catch {
      return spaced;
    }
  }

  /**
   * Read a readable fragment (with or without `#`). Returns `{ payload,
   * corrections, keys }`: the compact payload, the problems found, and the
   * keys of the activities, milestones and periods in payload order, for
   * naming records in later messages. Throws an Error naming the record
   * for what cannot be read.
   */
  function read(fragment) {
    const corrections = [];
    const note = (where, message) => corrections.push(`${where}: ${message}`);
    // What cannot be read is collected, so one reading names every problem.
    const failures = [];
    const failAt = (where, message) => {
      failures.push(`${where}: ${message}`);
      return null;
    };
    const records = String(fragment).replace(/^#/, '').split('~');
    const head = records.shift();
    if (head !== `t=${VERSION}`)
      throw Error(`t: expected t=${VERSION}, found ${JSON.stringify(head)}`);

    const fields = new Map();
    const lists = { a: new Map(), s: new Map(), p: new Map(), m: new Map() };
    let ended = false;
    let last = 't';
    for (const [position, record] of records.entries()) {
      if (record === '') continue;
      if (record === '!') {
        ended = true;
        if (position !== records.length - 1) note('!', 'records after the end mark were read too');
        continue;
      }
      const match = /^([a-z])(\d*)(?:=(.*))?$/s.exec(record);
      if (!match) {
        note(JSON.stringify(record.slice(0, 30)), 'not a record and was ignored');
        continue;
      }
      const [, letter, number, value = ''] = match;
      const key = letter + number;
      last = key;
      if (lists[letter] && number) {
        if (lists[letter].has(Number(number))) note(key, 'appears twice; the second was ignored');
        else lists[letter].set(Number(number), value);
      } else if (['n', 'd', 'y', 'w', 'r', 'v', 'c'].includes(key)) {
        if (fields.has(key)) note(key, 'appears twice; the second was ignored');
        else fields.set(key, value);
      } else note(key, 'is not a record Tidigar knows and was ignored');
    }
    if (!ended) note('!', `the link has no end mark; it may have been cut after ${last}`);

    // Records in key order: a1, a2, … a10.
    const ordered = (map, letter) =>
      [...map]
        .sort(([left], [right]) => left - right)
        .map(([number, value]) => ({ key: `${letter}${number}`, value }));
    const activities = ordered(lists.a, 'a');
    const milestones = ordered(lists.s, 's');
    const periods = ordered(lists.p, 'p');
    const dimensions = ordered(lists.m, 'm');

    const payload = {};
    if (!fields.has('n')) note('n', 'the link has no name; it was called "Roadmap"');
    payload.n = fields.has('n') ? text(fields.get('n')) : 'Roadmap';
    if (fields.has('d')) payload.d = text(fields.get('d'));
    if (fields.has('w')) {
      payload.w = 1;
      if (fields.get('w')) note('w', 'is a flag and takes no value');
    }
    if (fields.has('r')) payload.r = text(fields.get('r'));

    // The year: given, or the first full date's, or this year.
    let year = Number(fields.get('y'));
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      const found = /(?:^|[/~=])((?:19|20|21|22)\d\d)-\d\d-\d\d/.exec(records.join('~'))?.[1];
      const fallback = found ? Number(found) : new Date().getUTCFullYear();
      note(
        'y',
        fields.has('y')
          ? `${JSON.stringify(fields.get('y'))} is not a year from 1900 to 2200; used ${fallback}`
          : `the link has no year; used ${fallback}`,
      );
      year = fallback;
    }
    payload.y = year;
    const base = Date.UTC(year, 0, 1) / DAY;
    // A day offset from MM-DD in the link's year or a full YYYY-MM-DD.
    const dayOf = (value, where, field) => {
      const match = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(value.trim());
      const full = match && [
        match[1] ? Number(match[1]) : year,
        Number(match[2]),
        Number(match[3]),
      ];
      const time = full ? Date.UTC(full[0], full[1] - 1, full[2]) : NaN;
      if (
        !Number.isFinite(time) ||
        new Date(time).getUTCMonth() !== full[1] - 1 ||
        new Date(time).getUTCDate() !== full[2]
      )
        return failAt(
          where,
          `${field} ${JSON.stringify(value)} is not a date as MM-DD or YYYY-MM-DD`,
        );
      return time / DAY - base;
    };
    // A number of days, at least one.
    const daysOf = (value, where) => {
      const days = Number(String(value).trim().replace(/d$/i, ''));
      if (!Number.isInteger(days) || days < 1)
        return failAt(
          where,
          `days ${JSON.stringify(value)} is not a whole number of days, 1 or more`,
        );
      return days;
    };

    // Dimensions: `Team:Household,Installer`.
    payload.m = dimensions.map(({ key, value }) => {
      const colon = value.indexOf(':');
      if (colon < 0) {
        failAt(key, 'expected Name:Option,Option');
        return [text(value), []];
      }
      const options = value
        .slice(colon + 1)
        .split(',')
        .map(text)
        .filter((name) => name.trim());
      return [
        text(value.slice(0, colon)),
        options.map((name, index) => [name, COLORS[index % COLORS.length]]),
      ];
    });
    if (!payload.m.length) delete payload.m;
    const dimensionList = payload.m || [];

    // Option names, one per dimension, as option numbers in dimension order.
    const valuesOf = (list, where) => {
      const values = dimensionList.map(() => 0);
      for (const raw of list.split(',')) {
        if (!raw.trim()) continue;
        const colon = raw.indexOf(':');
        const named = colon < 0 ? null : text(raw.slice(0, colon));
        const option = text(colon < 0 ? raw : raw.slice(colon + 1));
        const name = text(raw);
        const matches = [];
        dimensionList.forEach(([dimension, options], index) => {
          if (named !== null && !same(dimension, named)) return;
          const position = options.findIndex(([choice]) => same(choice, option));
          if (position >= 0) matches.push([index, position + 1]);
        });
        if (!matches.length) {
          note(where, `no dimension has the option ${JSON.stringify(name)}; it was left empty`);
          continue;
        }
        if (matches.length > 1)
          note(
            where,
            `${JSON.stringify(option)} is an option of several dimensions; the first was used`,
          );
        const [index, number] = matches[0];
        if (values[index] && values[index] !== number)
          note(
            where,
            `two options of ${JSON.stringify(dimensionList[index][0])}; the first was kept`,
          );
        else values[index] = number;
      }
      while (values.length && values[values.length - 1] === 0) values.pop();
      return values;
    };

    const activityIndex = new Map(activities.map(({ key }, index) => [key, index]));
    const milestoneIndex = new Map(milestones.map(({ key }, index) => [key, index]));
    // `@a1,a4,s2,a1:50`: predecessor indices and their start-after shares.
    const dependenciesOf = (list, where, allowMilestones) => {
      const indices = [];
      const shares = [];
      for (const part of list.split(',')) {
        const [key, share] = part.trim().split(':');
        if (!key) continue;
        let index = activityIndex.get(key);
        if (index === undefined && allowMilestones && milestoneIndex.has(key))
          index = activities.length + milestoneIndex.get(key);
        if (index === undefined) {
          note(
            where,
            `the dependency ${key} names no ${allowMilestones ? 'record' : 'activity'}; it was removed`,
          );
          continue;
        }
        indices.push(index);
        shares.push(share === undefined ? 100 : Number(String(share).replace('%', '')));
      }
      while (shares.length && shares[shares.length - 1] === 100) shares.pop();
      return [indices, shares];
    };

    // Periods: `title/start/days`, a vacation unless `work` follows.
    payload.p = periods.map(({ key, value }) => {
      const [title = '', start = '', days = '', ...rest] = value.split('/');
      const work = rest.includes('work');
      for (const field of rest)
        if (field && field !== 'work')
          note(key, `${JSON.stringify(field)} is not a period field and was ignored`);
      return [
        text(title),
        dayOf(start, key, 'start') ?? 0,
        (daysOf(days, key) ?? 1) - 1,
        PERIOD_COLOR,
        work ? 0 : 1,
      ];
    });
    // The days after an activity's start to its end: calendar days, or with
    // `w` work days, skipping weekends and vacation periods.
    const vacations = payload.p
      .filter((period) => period[4] === 1)
      .map(([, start, length]) => [start, start + length]);
    const lengthOf = (first, days) => {
      if (!payload.w) return days - 1;
      const working = (offset) => {
        const weekday = new Date((base + offset) * DAY).getUTCDay();
        return (
          weekday !== 0 &&
          weekday !== 6 &&
          !vacations.some(([from, to]) => offset >= from && offset <= to)
        );
      };
      let day = first;
      while (!working(day) && day - first < 400) day += 1;
      for (let count = 1; count < days && day - first < 4000;) {
        day += 1;
        if (working(day)) count += 1;
      }
      return day - first;
    };
    // Activities: `title/start/days`, then options, `@dependencies`,
    // progress such as `50p` and a description `d=` in any order.
    payload.i = activities.map(({ key, value }) => {
      const [title = '', start = '', days = '', ...rest] = value.split('/');
      const where = key;
      let values = [];
      let dependencies = [[], []];
      let progress = 0;
      let description = '';
      for (const field of rest) {
        if (!field) continue;
        if (field.startsWith('d=')) description = text(field.slice(2));
        else if (field.startsWith('@')) dependencies = dependenciesOf(field.slice(1), where, true);
        else if (/^\d+p$/.test(field)) progress = Number(field.slice(0, -1));
        // As people write it by hand.
        else if (/^\d+(%|%25)$/.test(field)) progress = Number(field.replace(/%.*/, ''));
        else values = valuesOf(field, where);
      }
      const first = dayOf(start, where, 'start') ?? 0;
      return [
        text(title),
        first,
        lengthOf(first, daysOf(days, where) ?? 1),
        description,
        progress,
        values,
        dependencies[0],
        dependencies[1],
      ];
    });
    // Milestones: `title/date`, then `@dependencies` or `fixed`.
    payload.s = milestones.map(({ key, value }) => {
      const [title = '', date = '', ...rest] = value.split('/');
      let dependsOn = [];
      let fixed = 0;
      for (const field of rest) {
        if (field === 'fixed') fixed = 1;
        else if (field.startsWith('@')) [dependsOn] = dependenciesOf(field.slice(1), key, false);
        else if (field)
          note(key, `${JSON.stringify(field)} is not a milestone field and was ignored`);
      }
      return [text(title), dayOf(date, key, 'date') ?? 0, dependsOn, fixed];
    });
    for (const key of ['i', 's', 'p']) if (!payload[key].length) delete payload[key];

    // The initial view: `timeline/classic/rows:Team/color:Phase`; a layout
    // word alone means a timeline.
    let classic = false;
    if (fields.has('v')) {
      const [mode, ...settings] = fields.get('v').split('/');
      const view = {};
      const word = mode.trim().toLowerCase();
      if (VIEWS[word]) view.view = VIEWS[word];
      else if (LAYOUTS[word] || STYLES.includes(word)) settings.unshift(word);
      else note('v', `${JSON.stringify(mode)} is not timeline, board, list or flow`);
      for (const setting of settings) {
        const plain = setting.trim().toLowerCase();
        if (LAYOUTS[plain]) {
          view.view ??= 'timeline';
          view.timelineActivityRows = LAYOUTS[plain];
          classic = plain === 'classic';
          continue;
        }
        if (STYLES.includes(plain)) {
          view.presentationStyle = plain;
          continue;
        }
        const [axis, name = ''] = setting.split(':');
        if (axis === 'start' || axis === 'end') {
          const offset = dayOf(name, 'v', axis);
          if (offset !== null)
            view[axis === 'start' ? 'timelineStart' : 'timelineEnd'] = new Date(
              (base + offset) * DAY,
            )
              .toISOString()
              .slice(0, 10);
          continue;
        }
        const field = VIEW_AXES[axis];
        const index = dimensionList.findIndex(([dimension]) => same(dimension, text(name)));
        if (!field)
          note(
            'v',
            `${JSON.stringify(axis)} is not classic, compact, a style, rows, columns, color, group, start or end`,
          );
        else if (index < 0)
          note('v', `${axis}: no dimension is called ${JSON.stringify(text(name))}`);
        else view[field] = index;
      }
      payload.o = view;
    }

    // The counts the link promises: activities, milestones, periods.
    if (fields.has('c')) {
      const promised = fields.get('c').split('.').map(Number);
      [activities, milestones, periods].forEach((list, index) => {
        const expected = promised[index] ?? 0;
        if (Number.isInteger(expected) && expected !== list.length)
          note(
            'c',
            `expects ${expected} ${KINDS['asp'[index]]} records; the link has ${list.length}${
              expected > list.length ? ', so some are missing' : ''
            }`,
          );
      });
    } else note('c', 'the link has no counts, so a missing record could not be detected');
    for (const [list, letter] of [
      [activities, 'a'],
      [milestones, 's'],
      [periods, 'p'],
    ]) {
      const missing = [];
      const highest = list.length ? Number(list[list.length - 1].key.slice(1)) : 0;
      for (let number = 1; number < highest; number += 1)
        if (!lists[letter].has(number)) missing.push(`${letter}${number}`);
      if (missing.length) note(missing.join(', '), 'missing from the link');
    }

    if (failures.length)
      throw Error(
        [failures.join('; '), corrections.length ? `Also: ${corrections.join('; ')}` : '']
          .filter(Boolean)
          .join('. '),
      );
    return {
      payload,
      classic,
      corrections,
      keys: {
        items: activities.map(({ key }) => key),
        milestones: milestones.map(({ key }) => key),
        periodIndicators: periods.map(({ key }) => key),
      },
    };
  }

  /* Text in a field: a space is `_`. What would end or split a field, and
     what a chat or a Markdown link would break on, is escaped. */
  const ESCAPED = new Set('%~/_&#"<>`(){}[]|\\^');
  const field = (value, also = '') =>
    [...String(value)]
      .map((character) =>
        character === ' '
          ? '_'
          : ESCAPED.has(character) || also.includes(character) || /\s/.test(character)
            ? encodeURIComponent(character).replace(
                /^[^%]$/,
                `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
              )
            : character,
      )
      .join('');
  const name = (value) => field(value, ',:@=');

  /**
   * Write a valid compact payload as a readable fragment, `t=1~…~!`, for a
   * builder that has validated the roadmap. Colors are left out.
   */
  function write(payload) {
    const year = payload.y;
    const base = Date.UTC(year, 0, 1) / DAY;
    const date = (offset) => {
      const iso = new Date((base + offset) * DAY).toISOString().slice(0, 10);
      return iso.startsWith(`${year}-`) ? iso.slice(5) : iso;
    };
    const dimensions = payload.m || [];
    const items = payload.i || [];
    const milestones = payload.s || [];
    const periods = payload.p || [];
    const vacations = periods
      .filter((period) => (period[4] ?? 1) === 1)
      .map(([, start, length]) => [start, start + length]);
    const working = (offset) => {
      const weekday = new Date((base + offset) * DAY).getUTCDay();
      return (
        weekday !== 0 &&
        weekday !== 6 &&
        !vacations.some(([from, to]) => offset >= from && offset <= to)
      );
    };
    // An activity's days: calendar days, or with work days those it covers.
    const daysOf = (start, length) => {
      if (payload.w !== 1) return length + 1;
      let count = 0;
      for (let day = start; day <= start + length; day += 1) if (working(day)) count += 1;
      return Math.max(1, count);
    };
    const shared = (option, index) =>
      dimensions.some(
        ([, options], other) => other !== index && options.some(([choice]) => choice === option),
      );
    const keyOf = (index) =>
      index < items.length ? `a${index + 1}` : `s${index - items.length + 1}`;
    const records = ['t=1', `n=${field(payload.n)}`];
    if (payload.d) records.push(`d=${field(payload.d)}`);
    records.push(`y=${year}`);
    if (payload.w === 1) records.push('w');
    if (payload.r) records.push(`r=${field(payload.r)}`);
    dimensions.forEach(([dimension, options], index) =>
      records.push(
        `m${index + 1}=${name(dimension)}:${options.map(([option]) => name(option)).join(',')}`,
      ),
    );
    items.forEach(
      (
        [
          title,
          start,
          length,
          description = '',
          progress = 0,
          values = [],
          dependsOn = [],
          parts = [],
        ],
        index,
      ) => {
        const fields = [field(title), date(start), daysOf(start, length)];
        const options = values
          .map((choice, position) => {
            if (!choice) return '';
            const option = dimensions[position][1][choice - 1][0];
            // A name shared by two dimensions, or one that reads as progress.
            return shared(option, position) || /^\d+p$/.test(option)
              ? `${name(dimensions[position][0])}:${name(option)}`
              : name(option);
          })
          .filter(Boolean);
        if (options.length) fields.push(options.join(','));
        if (dependsOn.length)
          fields.push(
            `@${dependsOn
              .map((predecessor, position) =>
                (parts[position] ?? 100) === 100
                  ? keyOf(predecessor)
                  : `${keyOf(predecessor)}:${parts[position]}`,
              )
              .join(',')}`,
          );
        if (progress) fields.push(`${progress}p`);
        if (description) fields.push(`d=${field(description)}`);
        records.push(`a${index + 1}=${fields.join('/')}`);
      },
    );
    milestones.forEach(([title, day, dependsOn = [], fixed = 0], index) => {
      const fields = [field(title), date(day)];
      if (fixed === 1) fields.push('fixed');
      else if (dependsOn.length) fields.push(`@${dependsOn.map(keyOf).join(',')}`);
      records.push(`s${index + 1}=${fields.join('/')}`);
    });
    periods.forEach(([title, start, length, , vacation = 1], index) =>
      records.push(
        `p${index + 1}=${field(title)}/${date(start)}/${length + 1}${vacation === 1 ? '' : '/work'}`,
      ),
    );
    if (payload.o) {
      const view = payload.o;
      const mode = { grid: 'board', timeline: 'timeline', list: 'list', flow: 'flow' }[
        view.view ?? 'grid'
      ];
      const settings = [mode];
      const layout = Object.keys(LAYOUTS).find(
        (word) => LAYOUTS[word] === view.timelineActivityRows,
      );
      if (layout) settings.push(layout);
      if (STYLES.includes(view.presentationStyle)) settings.push(view.presentationStyle);
      for (const [axis, key] of Object.entries(VIEW_AXES))
        if (Number.isInteger(view[key])) settings.push(`${axis}:${name(dimensions[view[key]][0])}`);
      const offset = (iso) => Date.parse(`${iso}T00:00:00Z`) / DAY - base;
      if (view.timelineStart) settings.push(`start:${date(offset(view.timelineStart))}`);
      if (view.timelineEnd) settings.push(`end:${date(offset(view.timelineEnd))}`);
      records.push(`v=${settings.join('/')}`);
    }
    records.push(`c=${items.length}.${milestones.length}.${periods.length}`, '!');
    return records.join('~');
  }

  /* A message about a payload's records (`activity i[2] "Build"`) in the
     readable link's own keys (`a3 "Build"`). */
  function inKeys(message, keys) {
    return String(message).replace(
      /\b(?:activity|milestone|period) ([isp])\[(\d+)\]/g,
      (whole, list, index) => {
        const key = { i: keys.items, s: keys.milestones, p: keys.periodIndicators }[list][
          Number(index)
        ];
        return key ?? whole;
      },
    );
  }

  return Object.freeze({ read, write, inKeys, isReadable, VERSION });
});
})(scope);
(function (globalThis) {
/* Share links: a whole project and its initial view packed into a URL
   fragment small enough to share anywhere. IDs become positions in
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
  // A lenient reader opens a longer hand-written link and says it is too long.
  const LENIENT_FRAGMENT_LENGTH = 32768;
  const DAY = 86400000;
  // A link never carries assignee settings: a copy is no Tidigar Cloud plan,
  // so it has no assignees to arrange or show. Collapsed timeline summaries
  // are personal; an older link that still carries them opens without them.
  const OMITTED_VIEW_FIELDS = new Set([
    'id',
    'projectId',
    'name',
    'hideTimelineLabels',
    'showAssignee',
    'timelineCollapsedSummaries',
  ]);
  const DIMENSION_FIELDS = new Set([
    'row',
    'col',
    'color',
    'group',
    'flowGroup',
    'timelineSummarizeBy',
  ]);
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

  /* The checksum after a link's data: the CRC-32 (as zlib and PNG compute
     it) of the data's characters, as four big-endian bytes in base64url. */
  const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const CRC_TABLE = new Uint32Array(256).map((_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value;
  });
  const crcStep = (state, code) => CRC_TABLE[(state ^ code) & 255] ^ (state >>> 8);
  function checksumOf(data) {
    let state = 0xffffffff;
    for (let index = 0; index < data.length; index += 1)
      state = crcStep(state, data.charCodeAt(index));
    return checkText(~state >>> 0);
  }
  function checkText(value) {
    const [a, b, c, d] = [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
    return [
      a >> 2,
      ((a & 3) << 4) | (b >> 4),
      ((b & 15) << 2) | (c >> 6),
      c & 63,
      d >> 2,
      (d & 3) << 4,
    ]
      .map((index) => BASE64URL[index])
      .join('');
  }

  /* The data a single changed, lost or added character turns into data
     with this checksum: every such edit whose CRC matches, without
     recomputing the CRC of each candidate. Feeding a CRC is affine, so the
     state after the edit is carried over the unchanged rest by the matrix
     of feeding that many zero bytes, plus the rest's own contribution. */
  function restorations(data, checksum) {
    const length = data.length;
    const prefix = new Uint32Array(length + 1);
    prefix[0] = 0xffffffff;
    for (let index = 0; index < length; index += 1)
      prefix[index + 1] = crcStep(prefix[index], data.charCodeAt(index));
    // zeros[n * 32 + k]: bit k carried over n zero bytes.
    const zeros = new Uint32Array((length + 2) * 32);
    for (let bit = 0; bit < 32; bit += 1) zeros[bit] = (1 << bit) >>> 0;
    for (let count = 1; count <= length + 1; count += 1)
      for (let bit = 0; bit < 32; bit += 1)
        zeros[count * 32 + bit] = crcStep(zeros[(count - 1) * 32 + bit], 0);
    const carry = (count, state) => {
      let result = 0;
      for (let bit = 0; bit < 32; bit += 1)
        if ((state >>> bit) & 1) result ^= zeros[count * 32 + bit];
      return result >>> 0;
    };
    // rest[index]: the contribution of data[index…] fed from state 0.
    const rest = new Uint32Array(length + 1);
    for (let index = length - 1; index >= 0; index -= 1)
      rest[index] =
        (carry(length - index - 1, crcStep(0, data.charCodeAt(index))) ^ rest[index + 1]) >>> 0;
    const finish = (state, from) => checkText(~(carry(length - from, state) ^ rest[from]) >>> 0);
    const found = new Map();
    const keep = (text, edit) => {
      if (!found.has(text)) found.set(text, edit);
    };
    for (let index = 0; index <= length; index += 1) {
      for (const character of BASE64URL) {
        const code = character.charCodeAt(0);
        if (finish(crcStep(prefix[index], code), index) === checksum)
          keep(
            data.slice(0, index) + character + data.slice(index),
            `a lost character was restored at position ${index + 1}`,
          );
        if (
          index < length &&
          character !== data[index] &&
          finish(crcStep(prefix[index], code), index + 1) === checksum
        )
          keep(
            data.slice(0, index) + character + data.slice(index + 1),
            `a changed character was restored at position ${index + 1}`,
          );
      }
      if (index < length && finish(prefix[index], index + 1) === checksum)
        keep(
          data.slice(0, index) + data.slice(index + 1),
          `an added character was removed at position ${index + 1}`,
        );
    }
    return [...found].map(([text, edit]) => ({ data: text, edit }));
  }

  // A fragment from a link's data, with its checksum.
  const sealed = (data) => `${PREFIX}${data}.${checksumOf(data)}`;

  function toBase64Url(bytes) {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
     for JavaScript engines without streams or atob. */
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

  /* Opening surfaces may supply a dates-only repair, or `lenient`, a
     share-link tidy (`share-link-tidy.js`) that reads a hand-written link
     and reports each correction. Encoders stay strict. */
  function createFactory({ model, repairDates = null, lenient = null, readable = null }) {
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
        for (const [key, stored] of Object.entries(view)) {
          if (OMITTED_VIEW_FIELDS.has(key)) continue;
          const value = DIMENSION_FIELDS.has(key) && stored === model.assigneeAxis ? '' : stored;
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
      if (manifest.refPrefix) payload.r = manifest.refPrefix;
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
              trimTail(
                item.dependsOn.map((id) => item.startAfter?.[id] ?? 100),
                item.dependsOn.map(() => 100),
              ),
              item.ref ?? '',
            ],
            [null, null, null, '', 0, [], [], [], ''],
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
              milestone.ref ?? '',
            ],
            [null, null, [], 0, ''],
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
    function positionNames(raw) {
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
      return names;
    }
    function inPositions(raw, validate, initialView = false) {
      try {
        return validate();
      } catch (error) {
        if (error instanceof ShareLinkError) throw error;
        const names = positionNames(raw);
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
    function unpack(input, { like = null } = {}) {
      let payload = input;
      const corrections = [];
      if (lenient) {
        const tidied = lenient.tidyPayload(input);
        payload = tidied.payload;
        corrections.push(...tidied.corrections);
      }
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
          ...(payload.r === undefined ? {} : { refPrefix: payload.r }),
        },
        items: packedItems.map((entry, index) => {
          const [
            title,
            start,
            length,
            description = '',
            progress = 0,
            values,
            dependsOn,
            parts,
            ref = '',
          ] = entry;
          const choices = list(values);
          const predecessorIds = list(dependsOn).map((position) => at(predecessors, position));
          const shares = list(parts);
          if (shares.length > predecessorIds.length)
            fail('invalid', 'The share link refers to a missing entry.');
          const startAfter = Object.fromEntries(
            shares
              .map((share, position) => [predecessorIds[position], share])
              .filter(([, share]) => share !== 100),
          );
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
            dependsOn: predecessorIds,
            ...(Object.keys(startAfter).length ? { startAfter } : {}),
            ...(ref === '' ? {} : { ref }),
          };
        }),
        sharedViews: list(payload.v).map((packed, index) =>
          own({ ...unpackView(packed), name: packed.name }, like?.sharedViews[index]),
        ),
        milestones: list(payload.s).map((entry, index) => {
          const [title, day, dependsOn, fixed = 0, ref = ''] = list(entry);
          if (fixed !== 0 && fixed !== 1)
            fail('invalid', 'The share link has an invalid milestone.');
          return {
            id: milestoneIds[index],
            projectId,
            title,
            date: date(day),
            dependsOn: dependencies(dependsOn),
            fixed: fixed === 1,
            ...(ref === '' ? {} : { ref }),
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
      let repairs = [];
      const project = inPositions(raw, () => {
        try {
          return model.normalizeProject(raw);
        } catch (error) {
          if (lenient) {
            const repaired = lenient.repair(raw, positionNames(raw));
            repairs = repaired.repairs;
            corrections.push(...repaired.corrections);
            return repaired.project;
          }
          if (!repairDates) throw error;
          const repaired = repairDates(raw);
          repairs = repaired.repairs;
          return repaired.project;
        }
      });
      let view = null;
      if (payload.o !== undefined) {
        const initial = own({ ...unpackView(payload.o), name: '-' });
        if (lenient && !lenient.tidyView(initial, project.manifest, 'initial view o', corrections))
          corrections.push('initial view o: the view could not be read and was left out');
        else {
          const [normalized] = inPositions(
            raw,
            () => model.normalizeViews([initial], project),
            true,
          );
          view = Object.fromEntries(
            Object.entries(normalized).filter(([key]) => !OMITTED_VIEW_FIELDS.has(key)),
          );
        }
      }
      return {
        project,
        view,
        ...(repairs.length ? { repairs } : {}),
        ...(corrections.length ? { corrections } : {}),
      };
    }

    /**
     * A smaller copy of a project and its initial view for a link:
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
        for (const record of [...project.items, ...project.milestones]) {
          record.dependsOn = record.dependsOn.filter((id) => kept.has(id));
          if (!record.startAfter) continue;
          for (const id of Object.keys(record.startAfter))
            if (!kept.has(id)) delete record.startAfter[id];
          if (!Object.keys(record.startAfter).length) delete record.startAfter;
        }
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
                (column) =>
                  ['title', 'duration', 'start', 'end', 'dependsOn'].includes(column) ||
                  dimensionIds.has(column),
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
     * What a screen link shows of one saved view, or null
     * when the plan has no such view: the activities its filters and search
     * show, with no descriptions, no other saved views and only the
     * dimensions the view arranges, colors or lists by. Reference keys stay
     * only where the view shows them. Filters and search are applied here,
     * so the snapshot's view carries neither.
     */
    function screenSnapshot(projectInput, viewId, { locale } = {}) {
      const source = model.normalizeProject(projectInput);
      const chosen = source.sharedViews.find((view) => view.id === viewId);
      if (!chosen) return null;
      const shown = model.activityMatcher(chosen, source.manifest.dimensions, locale);
      const { project } = reduce(source, null, {
        visibleItemIds: source.items.filter(shown).map((item) => item.id),
        withoutDescriptions: true,
      });
      const view = { ...chosen, filters: {}, query: '' };
      const used = new Set([...DIMENSION_FIELDS].map((key) => view[key]).filter(Boolean));
      if (view.view === 'list') for (const column of view.listColumns) used.add(column);
      project.manifest.dimensions = project.manifest.dimensions.filter((dimension) =>
        used.has(dimension.id),
      );
      for (const item of project.items)
        item.values = Object.fromEntries(
          Object.entries(item.values).filter(([id]) => used.has(id)),
        );
      const known = new Set(project.manifest.dimensions.map((dimension) => dimension.id));
      for (const key of COLUMN_FIELDS)
        view[key] = view[key].filter(
          (column) =>
            ['title', 'duration', 'start', 'end', 'dependsOn'].includes(column) ||
            known.has(column),
        );
      delete project.manifest.shareLinkCreatedAt;
      if (!view.showRefs) {
        delete project.manifest.refPrefix;
        for (const record of [...project.items, ...project.milestones]) delete record.ref;
      }
      project.sharedViews = [view];
      const snapshot = model.normalizeProject(project);
      return { project: snapshot, view: snapshot.sharedViews[0] };
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
      const data = toBase64Url(bytes);
      const fragment = sealed(data);
      if (fragment.length > MAX_FRAGMENT_LENGTH)
        fail('too-large', 'The roadmap is too large for a share link.', {
          length: fragment.length,
          limit: MAX_FRAGMENT_LENGTH,
        });
      return fragment;
    }

    // The checks before inflating: the version, the length and the alphabet.
    // Returns the link's data and, when lenient, what was read differently.
    function readFragment(fragment) {
      let text = typeof fragment === 'string' ? fragment.replace(/^#/, '') : '';
      const corrections = [];
      if (lenient && /%[0-9a-f]{2}/i.test(text))
        try {
          text = decodeURIComponent(text);
          corrections.push('link: the link was percent-encoded');
        } catch {
          // Read as it is.
        }
      const match = /^s=(\d+)\.(.*)$/s.exec(text);
      if (!match) fail('not-share-link', 'This is not a share link.');
      if (match[1] !== String(VERSION))
        fail('unsupported-version', 'This share link needs a newer version of Tidigar.');
      const limit = lenient ? LENIENT_FRAGMENT_LENGTH : MAX_FRAGMENT_LENGTH;
      if (text.length > limit)
        fail('too-large', 'The share link is too long.', { length: text.length, limit });
      if (text.length > MAX_FRAGMENT_LENGTH)
        corrections.push(
          `link: the fragment has ${text.length} characters, more than the ${MAX_FRAGMENT_LENGTH} a share link may have; apps and chats may cut it`,
        );
      const dot = match[2].lastIndexOf('.');
      let data = dot < 0 ? match[2] : match[2].slice(0, dot);
      const checksum = dot < 0 ? '' : match[2].slice(dot + 1);
      if (lenient) {
        const url = data
          .replace(/\s+/g, '')
          .replace(/=+$/, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_');
        if (url !== data) corrections.push('link: the data was read as base64url without padding');
        data = url;
      }
      if (!/^[A-Za-z0-9_-]+$/.test(data))
        fail(
          'corrupt',
          lenient
            ? 'The share link is damaged: its data holds characters outside base64url.'
            : 'The share link is damaged.',
        );
      if (checksum === checksumOf(data)) return { data, corrections };
      if (!lenient)
        fail('corrupt', 'The share link is damaged: its data does not match its checksum.');
      // A checksum that is missing or itself damaged cannot vouch for the data.
      if (!/^[A-Za-z0-9_-]{6}$/.test(checksum)) {
        corrections.push(
          checksum
            ? `link: the checksum ${JSON.stringify(checksum)} is damaged; the data could not be checked`
            : 'link: the link has no checksum, so damage on the way could not be detected',
        );
        return { data, corrections };
      }
      const restored = restorations(data, checksum);
      if (restored.length === 1) {
        corrections.push(`link: the link was damaged on the way; ${restored[0].edit}`);
        return { data: restored[0].data, corrections };
      }
      fail(
        'corrupt',
        `The share link was damaged on the way: its data does not match its checksum, and ${
          restored.length ? 'several different' : 'no'
        } single changed, lost or added characters explain it.`,
      );
    }

    /* The ways to read a link's bytes: raw DEFLATE, and when lenient also
       DEFLATE in a zlib or gzip wrapper, which libraries add by default, or
       JSON that was never compressed. `null` reads the bytes as text. */
    function readings(bytes) {
      const list = [[bytes, '']];
      if (!lenient) return list;
      if (bytes.length > 6 && (bytes[0] & 0x0f) === 8 && ((bytes[0] << 8) | bytes[1]) % 31 === 0)
        list.push([
          bytes.subarray(2, -4),
          'the data has a zlib header; share links use raw DEFLATE without one',
        ]);
      if (bytes.length > 18 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[3] === 0)
        list.push([bytes.subarray(10, -8), 'the data is gzip; share links use raw DEFLATE']);
      list.push([null, 'the data was not compressed; share links compress it with raw DEFLATE']);
      return list;
    }
    function uncompressed(bytes) {
      const text = utf8Text(bytes);
      if (!/^\s*\{/.test(text)) fail('corrupt', 'The share link is damaged.');
      return text;
    }
    function readPayload(text, corrections, options) {
      let payload;
      try {
        payload = JSON.parse(text);
      } catch (error) {
        fail('invalid', `The share link holds no valid JSON. ${error.message}`);
      }
      let result;
      try {
        result = unpack(payload, options);
      } catch (error) {
        if (error instanceof ShareLinkError) throw error;
        fail('invalid', `The share link holds an invalid roadmap. ${error.message}`);
      }
      const all = [...corrections, ...(result.corrections ?? [])];
      return all.length ? { ...result, corrections: all } : result;
    }

    /**
     * Decode a fragment (with or without `#`) into `{ project, view }`: a
     * validated project under new IDs and the normalized initial view, or
     * `null`; `options.like` keeps that project's IDs (see `unpack`). Error codes:
     * `not-share-link`, `unsupported-version`, `too-large`, `corrupt`,
     * `invalid`. A configured `repairDates` callback may correct dependency
     * dates; a repaired result also includes `{ collection, id, fields }[]`
     * in `repairs`. Strict validation is always tried first. A `lenient`
     * factory also reads hand-written links and lists each correction, in
     * English, in `corrections`.
     */
    /* A readable link (`t=1~…`, `readable-link.js`), read leniently: its
       problems and the tidy's corrections name records by their keys. */
    function readReadable(fragment, options) {
      const text = String(fragment).replace(/^#/, '');
      const lengthNotes = [];
      if (text.length > LENIENT_FRAGMENT_LENGTH)
        fail('too-large', 'The share link is too long.', {
          length: text.length,
          limit: LENIENT_FRAGMENT_LENGTH,
        });
      if (text.length > MAX_FRAGMENT_LENGTH)
        lengthNotes.push(
          `link: the fragment has ${text.length} characters, more than the ${MAX_FRAGMENT_LENGTH} a share link may have; apps and chats may cut it`,
        );
      let read;
      try {
        read = readable.read(text);
      } catch (error) {
        fail('invalid', `The readable link cannot be read. ${error.message}`);
      }
      let result;
      try {
        result = unpack(read.payload, options);
      } catch (error) {
        if (error instanceof ShareLinkError) throw error;
        fail(
          'invalid',
          `The share link holds an invalid roadmap. ${readable.inKeys(error.message, read.keys)}`,
        );
      }
      // A readable link opens as a new plan does; `classic` asks for its
      // Classic view.
      const { corrections: tidied = [], ...rest } = result;
      const opened = { ...rest, readable: { classic: read.classic } };
      const corrections = [
        ...lengthNotes,
        ...read.corrections,
        ...tidied.map((line) => readable.inKeys(line, read.keys)),
      ];
      return corrections.length ? { ...opened, corrections } : opened;
    }

    async function decode(fragment, options) {
      if (lenient && readable?.isReadable(fragment)) return readReadable(fragment, options);
      const { data, corrections } = readFragment(fragment);
      const bytes = base64UrlBytes(data);
      for (const [input, note] of readings(bytes)) {
        let text;
        try {
          text = input
            ? new TextDecoder('utf-8', { fatal: true }).decode(
                await readAll(
                  transform(input, new DecompressionStream('deflate-raw')),
                  MAX_INFLATED_BYTES,
                ),
              )
            : uncompressed(bytes);
        } catch (error) {
          if (error instanceof ShareLinkError && error.code !== 'corrupt') throw error;
          continue;
        }
        return readPayload(text, note ? [...corrections, `link: ${note}`] : corrections, options);
      }
      fail('corrupt', 'The share link is damaged.');
    }

    /**
     * `decode` without waiting and without web APIs, for a start that cannot
     * wait and for engines without streams, such as the apps' model runtime.
     */
    function decodeSync(fragment, options) {
      if (lenient && readable?.isReadable(fragment)) return readReadable(fragment, options);
      const { data, corrections } = readFragment(fragment);
      const bytes = base64UrlBytes(data);
      for (const [input, note] of readings(bytes)) {
        let text;
        try {
          text = input ? utf8Text(inflateRaw(input, MAX_INFLATED_BYTES)) : uncompressed(bytes);
        } catch (error) {
          if (error instanceof ShareLinkError && error.code !== 'corrupt') throw error;
          continue;
        }
        return readPayload(text, note ? [...corrections, `link: ${note}`] : corrections, options);
      }
      fail('corrupt', 'The share link is damaged.');
    }

    return { encode, decode, decodeSync, pack, unpack, reduce, screenSnapshot };
  }

  // Public addresses: the opener that makes a copy in the
  // reader's Tidigar, and the embed edition a blog frames.
  const OPENER_URL = 'https://open.tidigar.com/s';
  const SPEC_URL = 'https://tidigar.com/docs/share-links.html';
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
     setting; it goes in the frame's name, so the address stays the same.
     `href` is where the plain link goes: the opener by default, the screen
     link itself for a screen link. `embedURL` selects the reader
     and helper paired with that screen's deployment. */
  function embedCode(
    fragment,
    { title, linkText, theme = null, href = `${OPENER_URL}#${fragment}`, embedURL = EMBED_URL },
  ) {
    const name = theme === 'dark' || theme === 'light' ? ` name="tidigar-theme-${theme}"` : '';
    return (
      `<iframe src="${escapeHTML(`${embedURL}#${fragment}`)}"${name} title="${escapeHTML(title)}" width="100%" ` +
      `height="480" style="border:0;max-width:100%" loading="lazy"></iframe>\n` +
      `<p><a href="${escapeHTML(href)}">${escapeHTML(linkText)}</a></p>\n` +
      // Sets the iframe to the height of its roadmap; without it the height
      // above applies. The escaped slash keeps this source inline in HTML.
      `<script async src="${escapeHTML(embedURL)}embed.js"><\/script>`
    );
  }

  /* What went wrong with a link, in English for whoever made it: an AI
     agent, a script or a person who knows the format. `error` for a link
     that did not open, or the `corrections` it opened with. */
  function report(fragment, { error = null, corrections = [] }) {
    const text = String(fragment).replace(/^#/, '');
    const lines = [
      error
        ? 'Tidigar could not open this share link.'
        : `Tidigar opened this share link after ${corrections.length} corrections.`,
      `Link: #${text.length > 60 ? `${text.slice(0, 60)}…` : text} (${text.length} characters)`,
    ];
    if (error) lines.push(`Problem (${error.code}): ${error.message}`);
    if (corrections.length) lines.push('Corrections:', ...corrections.map((line) => `- ${line}`));
    lines.push(`Format: ${SPEC_URL}`);
    return lines.join('\n');
  }

  return {
    createFactory,
    report,
    embedCode,
    ShareLinkError,
    VERSION,
    MAX_FRAGMENT_LENGTH,
    MAX_INFLATED_BYTES,
    OPENER_URL,
    SPEC_URL,
    sealed,
    EMBED_URL,
  };
});
})(scope);
(function (globalThis) {
/* The plan format for AI agents: a roadmap written with real
   dates, names and titles instead of the share link's day offsets and
   positions. `toPayload` turns a plan into a share-link payload and fills in
   what is not semantic: the year, option colors and a timeline that fits the
   plan. `fromPayload` reads a payload back into a plan an agent can edit.
   The schema at tidigar.com/agents/schema/plan-v1.json describes the same format. */
(function installTidigarPlan(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.tidigarPlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTidigarPlan() {
  'use strict';

  const DAY = 86400000;
  const SCHEMA = 'https://tidigar.com/agents/schema/plan-v1.json';
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
    layout: 'timelineActivityRows',
    style: 'presentationStyle',
  };
  // A timeline's layout: `classic` is one activity per row under a fixed
  // label, as in MS Project; `compact` lets activities share rows.
  const LAYOUTS = { classic: 'single-label', compact: 'compact' };
  const STYLES = ['standard', 'minimal', 'airy', 'contrast', 'terminal'];
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
    activity: [
      'title',
      'start',
      'end',
      'description',
      'progress',
      'values',
      'dependsOn',
      'startAfter',
    ],
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
    // Colors matter in a stored plan; a link carries none, and its options
    // take these in order.
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
      const dependsOn = dependencies(activity.dependsOn, `${path}.dependsOn`, true);
      const startAfter = list(activity.startAfter, `${path}.startAfter`).slice();
      if (startAfter.length > dependsOn.length)
        fail(`${path}.startAfter`, 'must not have more entries than dependsOn');
      startAfter.forEach((share, position) => {
        if (![0, 25, 50, 75, 100].includes(share))
          fail(`${path}.startAfter[${position}]`, 'must be one of 0, 25, 50, 75, or 100');
        if (share !== 100 && dependsOn[position] >= activities.length)
          fail(`${path}.startAfter[${position}]`, 'a fixed milestone requires 100');
      });
      while (startAfter.at(-1) === 100) startAfter.pop();
      return {
        title: text(activity.title, `${path}.title`, ''),
        start,
        length: end - start,
        description: text(activity.description, `${path}.description`, ''),
        progress: activity.progress ?? 0,
        values: Array.from(values, (value) => value ?? 0),
        dependsOn,
        startAfter,
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
            item.startAfter,
          ],
          [null, null, null, '', 0, [], [], []],
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
      } else if (key === 'layout') {
        if (!LAYOUTS[view.layout]) fail(path, 'must be classic or compact');
        o[field] = LAYOUTS[view.layout];
      } else if (key === 'style') {
        if (!STYLES.includes(view.style)) fail(path, `must be ${STYLES.join(', ')}`);
        o[field] = view.style;
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
          startAfter = [],
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
          if (startAfter.length) activity.startAfter = startAfter.slice();
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
        else if (key === 'layout') {
          const layout = Object.keys(LAYOUTS).find((name) => LAYOUTS[name] === value);
          if (layout) view.layout = layout;
        } else if (key === 'style') {
          if (value !== 'standard') view.style = value;
        } else view[key] = value;
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
  function describe(
    project,
    labels = { i: 'activities', s: 'milestones', p: 'periods', v: 'views' },
  ) {
    const position = new Map();
    project.items.forEach((item, index) => position.set(item.id, `${labels.i}[${index}]`));
    project.milestones.forEach((point, index) => position.set(point.id, `${labels.s}[${index}]`));
    const after = (record) =>
      record.dependsOn.length
        ? ` · after ${record.dependsOn.map((id) => position.get(id) + (record.startAfter?.[id] === undefined ? '' : ` (${record.startAfter[id]}%)`)).join(', ')}`
        : '';
    const values = (item) =>
      project.manifest.dimensions
        .map((dimension) => {
          const choice = dimension.options.find(
            (option) => option.id === item.values[dimension.id],
          );
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

  return Object.freeze({
    SCHEMA,
    COLORS,
    PlanError,
    toPayload,
    fromPayload,
    isPlan,
    inPlanTerms,
    describe,
  });
});
})(scope);

const model = scope.tidigarModel;
const shareLink = scope.tidigarShareLink;
const readable = scope.tidigarReadableLink;
const planFormat = scope.tidigarPlan;
// Building validates strictly; reading is as lenient as Tidigar.
const codec = shareLink.createFactory({ model });
const reader = shareLink.createFactory({
  model,
  readable,
  lenient: scope.tidigarShareLinkTidy.createFactory({
    model,
    repairProject: (project) =>
      scope.tidigarProjectRepair.createFactory({ model }).repairProject(project),
  }),
});

export const OPENER_URL = shareLink.OPENER_URL;
export const MAX_FRAGMENT_LENGTH = shareLink.MAX_FRAGMENT_LENGTH;
export const PLAN_SCHEMA = planFormat.SCHEMA;

// A summary and an error name records by their place in the plan's lists.
const PLAN_LABELS = { i: 'activities', s: 'milestones', p: 'periods', v: 'views' };

const { inPlanTerms, describe } = planFormat;

// Parameters after the link, such as a screen's token `&k=`, are left out.
function fragmentOf(link) {
  const text = String(link).trim();
  const hash = text.indexOf('#');
  return (hash < 0 ? text : text.slice(hash + 1)).split('&')[0];
}

/**
 * Validate a plan and build its link. Returns `{ url, fragment, length,
 * limit, summary }`, where `length` is the fragment's length against
 * `limit`, `MAX_FRAGMENT_LENGTH`. Throws an error whose message names the
 * broken rule and the record, such as `activities[2] "Build"`.
 */
export function createLink(plan) {
  if (typeof plan === 'string') plan = JSON.parse(plan);
  if (!planFormat.isPlan(plan)) throw new Error('Give a plan: see tidigar.com/llms.txt.');
  let project, view;
  try {
    ({ project, view } = codec.unpack(planFormat.toPayload(plan)));
  } catch (error) {
    throw inPlanTerms(error);
  }
  const fragment = readable.write(codec.pack(project, view));
  if (fragment.length > MAX_FRAGMENT_LENGTH)
    throw new Error(
      `The roadmap is too large for a link. It needs ${fragment.length} of ${MAX_FRAGMENT_LENGTH} characters; shorten titles, drop descriptions and merge small activities.`,
    );
  return {
    url: `${OPENER_URL}#${fragment}`,
    fragment,
    length: fragment.length,
    limit: MAX_FRAGMENT_LENGTH,
    summary: describe(project, PLAN_LABELS),
  };
}

/**
 * Read a readable Tidigar link (`#t=1~…`), or its fragment, into `{ plan,
 * summary, corrections }`: the roadmap as a plan to edit and build again,
 * and what Tidigar would correct when opening it.
 */
export function readLink(link) {
  const fragment = fragmentOf(link);
  if (!readable.isReadable(fragment)) throw new Error('Give a readable Tidigar link, #t=1~….');
  const { project, view, corrections = [] } = reader.decodeSync(fragment);
  const { plan } = planFormat.fromPayload(codec.pack(project, view));
  return { plan, summary: describe(project, PLAN_LABELS), corrections };
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
    const { plan, summary, corrections } = readLink(input);
    // The plan alone goes to standard output, so it can be saved and edited.
    console.log(JSON.stringify(plan, null, 2));
    console.error(summary);
    for (const line of corrections) console.error(`Corrected: ${line}`);
    return;
  }
  if (!input)
    throw new Error('Give a plan file, or - for standard input. See tidigar.com/llms.txt.');
  let text = '';
  if (input === '-') for await (const chunk of process.stdin) text += chunk;
  else text = await readFile(input, 'utf8');
  const plan = JSON.parse(text);
  const link = createLink(plan);
  console.log(link.url);
  console.log(`\n${link.summary}`);
  console.log(`\nFragment: ${link.length} of ${link.limit} characters.`);
  if (flags.has('--embed')) console.log(`\n${embedCode(link.url, plan.name)}`);
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
