GameObject2D = require('./game_object_2d.coffee').GameObject2D
Point = require('./point.coffee').Point
Random = require('./random.coffee').Random
AssetLoader = require('./asset_loader.coffee').AssetLoader

exports.Minesplosion = class Minesplosion extends GameObject2D
  __type: 'Minesplosion'

  constructor: (@id, @x, @y, @max_radius) ->
    super @id, @x, @y
    @lifespan = @ttl = 0.4
    @seed = @x + @y
    @radius = @max_radius

  clone: ->
    exp = new Minesplosion @id, @x, @y, @max_radius
    exp.lifespan = @lifespan
    exp.ttl = @ttl
    return exp

  update: (dt, state) ->
    @ttl -= dt

    super dt, state
    if @ttl <= 0
      state.removeObject @id

  draw: (context) ->
    context.save()

    random = new Random(@seed)
    smokePositions = []
    smokeScales = []
    smokeTypes = []
    numSmokes = 10
    for i in [0..numSmokes - 1]
      smokePositions.push([ -3.0 + random.nextf() * 6.0, -3.0 + random.nextf() * 6.0 ])
      smokeVelocity = [ -4.0 + random.nextf() * 8.0, -4.0 + random.nextf() * 8.0 ]
      smokeTypes.push(parseInt(random.next() % 3))
      if smokeTypes[i] < 2
        smokeScales.push(0.2 + random.nextf() * 0.3)
      else
        smokeScales.push(0.1 + random.nextf() * 0.15)
      for j in [0..((@lifespan - @ttl) * 60 * @lifespan)]
        smokePositions[i][0] += smokeVelocity[0]
        smokePositions[i][1] += smokeVelocity[1]
        smokeScales[i] *= 1.05

    context.translate @x, @y
    context.globalAlpha = 0.7 * (@ttl / @lifespan)

    for i in [0..numSmokes - 1]
      size = 64 * smokeScales[i]
      context.drawImage(
        AssetLoader.getInstance().getAsset("smoke" + smokeTypes[i]),
        smokePositions[i][0] - size/2,
        smokePositions[i][1] - size/2,
        size,
        size
      )

    context.restore()