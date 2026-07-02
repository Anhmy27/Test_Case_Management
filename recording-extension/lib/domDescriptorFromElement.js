import { MAX_PAYLOAD_TEXT_LENGTH } from './recordedEventConstants.js';
import { toTrimmed } from './textUtils.js';

const getLabelText = (element) => {
  if (!(element instanceof Element)) {
    return '';
  }

  if (element.id) {
    const forLabel = element.ownerDocument?.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (forLabel) {
      return toTrimmed(forLabel.textContent);
    }
  }

  const parentLabel = element.closest('label');
  if (parentLabel) {
    return toTrimmed(parentLabel.textContent);
  }

  return toTrimmed(element.getAttribute('aria-label'));
};

const getVisibleText = (element) => {
  if (!(element instanceof Element)) {
    return '';
  }

  const ariaLabel = toTrimmed(element.getAttribute('aria-label'));
  if (ariaLabel) {
    return ariaLabel;
  }

  const text = toTrimmed(element.textContent);
  if (text.length <= MAX_PAYLOAD_TEXT_LENGTH) {
    return text;
  }
  return text.slice(0, MAX_PAYLOAD_TEXT_LENGTH);
};

const getImplicitRole = (element) => {
  if (!(element instanceof Element)) {
    return '';
  }

  const explicitRole = toTrimmed(element.getAttribute('role'));
  if (explicitRole) {
    return explicitRole;
  }

  const tagName = element.tagName.toLowerCase();
  if (tagName === 'button') return 'button';
  if (tagName === 'a' && element.hasAttribute('href')) return 'link';
  if (tagName === 'select') return 'combobox';
  if (tagName === 'textarea') return 'textbox';
  if (tagName === 'input') {
    const type = toTrimmed(element.getAttribute('type')).toLowerCase() || 'text';
    if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    return 'textbox';
  }

  return '';
};

/**
 * Extract a serializable descriptor from a live DOM element (content script only).
 * @param {Element} element
 */
export const domDescriptorFromElement = (element) => {
  if (!(element instanceof Element)) {
    return {};
  }

  const tagName = element.tagName.toLowerCase();
  const role = getImplicitRole(element);
  const roleName = getVisibleText(element) || getLabelText(element) || toTrimmed(element.getAttribute('placeholder'));

  const descriptor = {
    tagName,
    testid: toTrimmed(element.getAttribute('data-testid')),
    id: toTrimmed(element.id),
    name: toTrimmed(element.getAttribute('name')),
    placeholder: toTrimmed(element.getAttribute('placeholder')),
    label: getLabelText(element),
    text: getVisibleText(element),
    role,
    roleName,
  };

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    descriptor.value = element.value;
    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      descriptor.checked = element.checked;
    }
  } else if (element instanceof HTMLSelectElement) {
    descriptor.value = element.value;
  }

  if (element instanceof HTMLInputElement && element.type === 'file') {
    descriptor.files = Array.from(element.files || []).map((file) => file.name);
  }

  return descriptor;
};
