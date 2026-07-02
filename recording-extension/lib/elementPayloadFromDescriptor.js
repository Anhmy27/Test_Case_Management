import { MAX_PAYLOAD_TEXT_LENGTH, MAX_SELECTOR_LENGTH } from './recordedEventConstants.js';
import { toTrimmed } from './textUtils.js';

const truncate = (value, maxLength) => {
  const text = toTrimmed(value);
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength);
};

const escapeCssAttributeValue = (value) => toTrimmed(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const buildSimpleSelector = (descriptor) => {
  const testid = toTrimmed(descriptor.testid);
  if (testid) {
    return `[data-testid="${escapeCssAttributeValue(testid)}"]`;
  }

  const id = toTrimmed(descriptor.id);
  if (id && !id.includes(' ')) {
    return `#${escapeCssAttributeValue(id)}`;
  }

  const name = toTrimmed(descriptor.name);
  const tagName = toTrimmed(descriptor.tagName).toLowerCase() || '*';
  if (name) {
    return `${tagName}[name="${escapeCssAttributeValue(name)}"]`;
  }

  return truncate(tagName, MAX_SELECTOR_LENGTH);
};

/**
 * Build locator-oriented payload from a DOM descriptor (browser or test fixture).
 * @param {object} descriptor
 */
export const elementPayloadFromDescriptor = (descriptor = {}) => {
  const payload = {
    tagName: truncate(descriptor.tagName, 40),
    testid: truncate(descriptor.testid, 120),
    id: truncate(descriptor.id, 120),
    name: truncate(descriptor.name, 120),
    placeholder: truncate(descriptor.placeholder, 160),
    label: truncate(descriptor.label, 160),
    text: truncate(descriptor.text, MAX_PAYLOAD_TEXT_LENGTH),
    role: truncate(descriptor.role, 40),
    roleName: truncate(descriptor.roleName, MAX_PAYLOAD_TEXT_LENGTH),
    selector: truncate(descriptor.selector || buildSimpleSelector(descriptor), MAX_SELECTOR_LENGTH),
  };

  if (descriptor.value !== undefined && descriptor.value !== null) {
    payload.value = truncate(descriptor.value, 500);
  }

  if (descriptor.checked === true) {
    payload.checked = true;
  }

  if (descriptor.files && Array.isArray(descriptor.files)) {
    payload.files = descriptor.files.map((file) => truncate(file, 260)).filter(Boolean);
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === '' || value === false || value === undefined || value === null) {
        return false;
      }
      if (Array.isArray(value) && value.length === 0) {
        return false;
      }
      return true;
    }),
  );
};
