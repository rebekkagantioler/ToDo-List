// Supabase uses an email-shaped identifier internally; these addresses receive no mail.
export function credentialsEmail(username:string,register:boolean,legacyName='',legacyEmail=''){
 const name=username.trim().toLowerCase();
 if(legacyName&&name===legacyName.trim().toLowerCase()){
  if(register)throw new Error('Dieser Benutzername ist bereits vergeben.');
  return legacyEmail;
 }
 // Keep access to accounts created with the previous email registration.
 if(!register&&name.includes('@'))return name;
 if(!/^[a-z0-9_-]{3,30}$/.test(name))throw new Error('Bitte wähle 3–30 Zeichen: Buchstaben (a–z), Zahlen, Bindestrich oder Unterstrich.');
 return `${name}@accounts.planraum.invalid`;
}
