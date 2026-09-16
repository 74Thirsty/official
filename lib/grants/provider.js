export class GrantProvider {
  get id() { throw new Error('Provider must declare an id.'); }
  get name() { throw new Error('Provider must declare a name.'); }

  async search(params) { throw new Error('search() not implemented.'); }
  async fetchDetails(opportunityId) { throw new Error('fetchDetails() not implemented.'); }
  normalize(record) { throw new Error('normalize() not implemented.'); }
}
