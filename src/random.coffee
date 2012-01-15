
exports.Random = class Random
  __type: 'Random'

  @MAX: 4294967294

  constructor: (seed) ->
    @last = seed

  next: ->
    @last = ((1664525 * @last) + 1013904223) % Random.MAX
    return @last
