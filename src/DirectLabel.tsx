import type {ComponentProps} from 'react';
// Keep native labels for accessibility, but do not forward clicks on text or empty space.
export function DirectLabel({onClick,...props}:ComponentProps<'label'>){
 return <label {...props} onClick={event=>{
  const target=event.target as Element;
  const control=target.closest?.('input,select,textarea,button,a[href],summary,[role="button"]');
  if(!control||!event.currentTarget.contains(control))event.preventDefault();
  onClick?.(event);
 }}/>;
}
