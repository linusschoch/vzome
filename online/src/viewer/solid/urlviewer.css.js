export const urlViewerCSS = `
.select__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  width: 200px;
  border-radius: 6px;
  padding: 0 10px 0 16px;
  font-size: 16px;
  line-height: 1;
  height: 40px;
  outline: none;
  background-color: white;
  border: 1px solid hsl(240 6% 90%);
  color: hsl(240 4% 16%);
  transition: border-color 250ms, color 250ms;
}
.select__trigger:hover {
  border-color: hsl(240 5% 65%);
}
.select__trigger:focus-visible {
  outline: 2px solid hsl(200 98% 39%);
  outline-offset: 2px;
}
.select__trigger[data-invalid] {
  border-color: hsl(0 72% 51%);
  color: hsl(0 72% 51%);
}
.select__value {
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}
.select__value[data-placeholder-shown] {
  color: hsl(240 4% 46%);
}
.select__icon {
  height: 20px;
  width: 20px;
  flex: 0 0 20px;
}
.select__description {
  margin-top: 8px;
  color: hsl(240 5% 26%);
  font-size: 12px;
  user-select: none;
}
.select__error-message {
  margin-top: 8px;
  color: hsl(0 72% 51%);
  font-size: 12px;
  user-select: none;
}
.select__content {
  background-color: white;
  border-radius: 6px;
  border: 1px solid hsl(240 6% 90%);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  transform-origin: var(--kb-select-content-transform-origin);
  animation: contentHide 250ms ease-in forwards;
}
.select__content[data-expanded] {
  animation: contentShow 250ms ease-out;
}
.select__listbox {
  overflow-y: auto;
  max-height: 360px;
  padding: 8px;
}
.select__item {
  font-size: 16px;
  line-height: 1;
  color: hsl(240 4% 16%);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 8px;
  position: relative;
  user-select: none;
  outline: none;
}
.select__item[data-disabled] {
  color: hsl(240 5% 65%);
  opacity: 0.5;
  pointer-events: none;
}
.select__item[data-highlighted] {
  outline: none;
  background-color: hsl(200 98% 39%);
  color: white;
}
.select__section {
  padding: 8px 0 0 8px;
  font-size: 14px;
  line-height: 32px;
  color: hsl(240 4% 46%);
}
.select__item-indicator {
  height: 20px;
  width: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
@keyframes contentShow {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes contentHide {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}
`;
