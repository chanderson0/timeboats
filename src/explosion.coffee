GameObject2D = require('./game_object_2d.coffee').GameObject2D
Point = require('./point.coffee').Point
Map = require('./map.coffee').Map
Random = require('./random.coffee').Random
AssetLoader = require('./asset_loader.coffee').AssetLoader

exports.Explosion = class Explosion extends GameObject2D
  __type: 'Explosion'

  constructor: (@id, @x, @y, @max_radius) ->
    super @id, @x, @y
    @lifespan = @ttl = 0.4
    @seed = @x + @y + @id
    @radius = @max_radius
    Map.getInstance().damageAt @x, @y, @max_radius

  clone: ->
    exp = new Explosion @id, @x, @y, @max_radius
    exp.lifespan = @lifespan
    exp.ttl = @ttl
    return exp

  update: (dt, state) ->
    @ttl -= dt

    for id, object of state.objects
      if object.__type == 'Square'
        dist = Point.getDistance(@x, @y, object.x, object.y)
        if dist < @max_radius * 0.3
          object.explode state
        else if dist < @max_radius
          object.vx += (object.x - @x) * 0.25
          object.vy += (object.y - @y) * 0.25

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
      smokeTypes.push(Math.floor(random.next() % 3))
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
      console.log numSmokes
      size = 64 * smokeScales[i]
      context.drawImage(
        AssetLoader.getInstance().getAsset("smoke" + smokeTypes[i]),
        smokePositions[i][0] - size/2,
        smokePositions[i][1] - size/2,
        size,
        size
      )

    context.restore()