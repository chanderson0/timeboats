GameObject2D = require('./game_object_2d.coffee').GameObject2D
Random = require('./random.coffee').Random
AssetLoader = require('./asset_loader.coffee').AssetLoader

exports.Goldsplosion = class Goldsplosion extends GameObject2D
  __type: 'Goldsplosion'

  constructor: (@id, @x, @y) ->
    super @id, @x, @y
    @lifespan = @ttl = 0.4
    @seed = @x + @y + 42

  clone: ->
    exp = new Goldsplosion @id, @x, @y
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
    goldPositions = []
    goldTypes = []
    numGolds = 10
    for i in [0..numGolds - 1]
      goldPositions.push([ -3.0 + random.nextf() * 6.0, -3.0 + random.nextf() * 6.0 ])
      goldVelocity = [ -4.0 + random.nextf() * 8.0, -4.0 + random.nextf() * 8.0 ]
      goldTypes.push(Math.floor(random.next() % 2))
      for j in [0..((@lifespan - @ttl) * 60 * @lifespan)]
        goldPositions[i][0] += goldVelocity[0]
        goldPositions[i][1] += goldVelocity[1]

    context.translate @x, @y
    context.globalAlpha = 0.85 * (@ttl / @lifespan)

    console.log goldTypes[0], goldTypes[1], goldTypes[2], goldTypes[3], goldTypes[4], goldTypes[5], goldTypes[6], goldTypes[7], goldTypes[8], goldTypes[9]

    for i in [0..numGolds - 1]
      size = halfsize = 0
      if (goldTypes[i] == 0)
        size = 15
        halfsize = 7
      else
        size = 7
        halfsize = 3
      context.drawImage(
        AssetLoader.getInstance().getAsset("sparkle" + goldTypes[i]),
        goldPositions[i][0] - halfsize,
        goldPositions[i][1] - halfsize,
        size,
        size
      )

    context.restore()