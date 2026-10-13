/** What `@salesforce/schema/<Object>.<Field>` resolves to: the platform's field reference shape. */
export function fieldReference(qualifiedName) {
    const [objectApiName, fieldApiName] = qualifiedName.split('.');
    return fieldApiName ? { objectApiName, fieldApiName } : { objectApiName };
}
