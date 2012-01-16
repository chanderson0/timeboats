
exports.Gaussian = class Gaussian
  __type: 'Gaussian'

  constructor: (variance) ->
    @denominator = 2.0 * variance
    @a = 1.0 / Math.sqrt(variance * 2.0 * Math.PI)
    @xMin = 0
    @yMin = 0
    @.clear()

  compute: (xMin, xMax, yMin, yMax) ->
    @.clear()
    @xMin = xMin
    @yMin = yMin
    for x in [xMin..xMax]
      col = []
      for y in [yMin..yMax]
        col.push @.get2d(x, y)
      @cache.push col
    @cached = true

  clear: ->
    @cache = []
    @cached = false

  get2d: (x, y) ->
    if @cached
      return @cache[x - @xMin][y - @yMin]
    else
      return @.get(x) * @.get(y)

  get: (x) -> @a * Math.pow(Math.E, -(x * x) / @denominator)