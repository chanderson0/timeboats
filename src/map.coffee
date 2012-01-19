GameObject = require('./game_object').GameObject
MapCell = require('./map_cell.coffee').MapCell
Random = require('./random.coffee').Random
Gaussian = require('./gaussian.coffee').Gaussian
Point = require('./point.coffee').Point

exports.Map = class Map extends GameObject
  __type: 'Map'
  instance = null

  @CELL_SIZE_PX: 12

  #singleton instantiator
  @getInstance: ->
    if not instance?
      instance = new @
    return instance

  # DO NOT CALL the constructor publicly. Use getInstance() instead
  constructor: ->
    @width = 0
    @height = 0
    @cells = []
    @isInitialized = false
    @random = null
    @waterLevel = 5
    @waterDt = 0
    @frame_num = 0
    @damages = []
    super

  clone: -> instance

  update: (dt) ->
    @waterDt += dt
    if (@waterDt >= 1 / 10)
      @waterDt = 0
      if @isInitialized
        for x in [0..@width - 1]
          for y in [0..@height - 1]
            @cells[x][y].excitement *= 0.9
            if (@random.nextf() > 0.97)
              @cells[x][y].excitement += -0.3 + @random.nextf() * 0.6

  draw: (context) ->
    if @isInitialized
      context.save()
      for x in [0..@width - 1]
        for y in [0..@height - 1]
          cellX = x * Map.CELL_SIZE_PX
          cellY = y * Map.CELL_SIZE_PX

          b = Math.floor(40 + @cells[x][y].altitude * 10)
          r = Math.floor(b * 0.9)
          g = r
          if @cells[x][y].altitude < @waterLevel
            alpha = 0.5 + @cells[x][y].excitement * 0.2
            landAlpha = 1 / (1 + alpha)
            waterAlpha = alpha / (1 + alpha)
            r = Math.floor(r * landAlpha + 60.0 * waterAlpha)
            g = Math.floor(g * landAlpha + 110.0 * waterAlpha)
            b = Math.floor(b * landAlpha + 150.0 * waterAlpha)

          if @cells[x][y].isPlant
            r = Math.floor(r * 0.2 + 72 * 0.8)
            g = Math.floor(g * 0.2 + 105 * 0.8)
            b = Math.floor(b * 0.2 + 87 * 0.8)

          context.fillStyle = "rgba(#{r}, #{g}, #{b}, 1)"
          context.fillRect cellX, cellY, cellX + Map.CELL_SIZE_PX, cellY + Map.CELL_SIZE_PX
      context.restore()

  # collision methods
  # collideWith(obj) expects a GameObject2D instance.
  # if the map collides with obj, it invokes obj.collide().

  collideWith: (obj, state, disturb = false) ->
    if @isInitialized
      xStart = @.getCellAt(obj.x - obj.radius)
      yStart = @.getCellAt(obj.y - obj.radius)
      xFinish = @.getCellAt(obj.x + obj.radius)
      yFinish = @.getCellAt(obj.y + obj.radius)

      collided = false
      for x in [xStart..xFinish]
        for y in [yStart..yFinish]
          if disturb
            @cells[x][y].excitement = 0.7
          if @cells[x][y].altitude >= @waterLevel # collision with terrain
            if not collided
              obj.collide state
              collided = true
              if not disturb
                x = xFinish + 1
                y = yFinish + 1


  # damage the terrain at (x, y) in a circle with radius (radius) pixels.
  damageAt: (x, y, radius) ->
    if @damages["f#{@frame_num}"]?
      @damages["f#{@frame_num}"].push [x, y, radius]
    else
      @damages["f#{@frame_num}"] = [[x, y, radius]]

  # update the map's current frame. this should be synched with the main game's frame.
  setFrame: (num, overwrite = false) ->
    @frame_num = num
    if overwrite
      @damages["f#{@frame_num}"] = []

  # after setting the map's current frame, this will update the terrain to reflect that frame.
  computeTerrainState: ->
    if @isInitialized
      @.resetTerrain()
      for i in [0..@frame_num]
        if @damages["f#{i}"]?
          @.applyDamageGaussian(d[0], d[1], d[2]) for d in @damages["f#{i}"]

  # reset the map terrain to the way it was at the beginning of time. (PANGEA?!)
  resetTerrain: ->
    if @isInitialized
      for x in [0..@width - 1]
        for y in [0..@height - 1]
          @cells[x][y].reset()

  applyDamageGaussian: (x, y, radius) ->
    if @isInitialized
      radius = Math.ceil(radius / Map.CELL_SIZE_PX)
      x = @.getCellAt(x)
      y = @.getCellAt(y)
      g = new Gaussian(radius * 0.8)
      for xG in [x - radius..x + radius]
        for yG in [y - radius..y + radius]
            if xG >= 0 and xG < @width and yG >= 0 and yG < @height
              @cells[xG][yG].altitude -= g.get2d(xG - x, yG - y) * 5.0
              if @cells[xG][yG].altitude < 0
                @cells[xG][yG].altitude = 0
              if @cells[xG][yG].altitude < @waterLevel
                @cells[xG][yG].isPlant = false


  getCellAt: (p) ->
    Math.floor(p / Map.CELL_SIZE_PX)



  # map generation methods
  # calling generate(seed) should deterministically generate a pseudorandom map based on seed.

  generate: (width, height, seed) ->
    @width = width
    @height = height
    @random = new Random(seed)

    # initialize a blank map
    @isInitialized = false
    @cells = []

    for x in [0..@width - 1]
      col = []
      for y in [0..@height - 1]
        col.push new MapCell(0)
      @cells.push col

    # raise the terrain by swiping gaussians across it

    # first some big wide ones (12, 14, 15)
    @.swipeGaussian(18, 20, 30)
    @.swipeGaussian(18, 20, 30)

    # now some medium ones (6, 8, 4 + 10)
    numGaussians = 1 + @random.next() % 3
    for i in [1..numGaussians]
      @.swipeGaussian(12, 14, 6 + @random.next() % 15)

    # finally some narrow tall ones (3, 6, 6)
    numGaussians = 1 + @random.next() % 4
    for i in [1..numGaussians]
      @.swipeGaussian(7, 10, 10)

    # now discretize our altitudes
    # and also make some cells trees.
    for x in [0..@width - 1]
      for y in [0..@height - 1]
        if @cells[x][y].altitude > @waterLevel + 1 and (@cells[x][y].altitude - @waterLevel - 1) * 0.03 > @random.nextf()
          @cells[x][y].isPlant = true
        @cells[x][y].altitude = Math.floor(@cells[x][y].altitude)
        @cells[x][y].saveInitialState()

    @isInitialized = true

  swipeGaussian: (variance, radius, gaussLife) ->
    gaussX = @random.next() % @width
    gaussY = @random.next() % @height
    gaussVelX = 0.5 + (@random.nextf() * 3.0)
    gaussVelY = 0.5 + (@random.nextf() * 3.0)
    gaussAccX = -0.2 + (@random.nextf() * 0.2)
    gaussAccY = -0.2 + (@random.nextf() * 0.2)

    # console.log "swipeGaussian starting at (#{gaussX},#{gaussY}) with vel (#{gaussVelX},#{gaussVelY}) and life #{gaussLife}"

    g = new Gaussian(variance)
    g.compute(-radius, radius, -radius, radius)
    for i in [1..gaussLife]
      @.applyGaussian(g, radius, Math.floor(gaussX), Math.floor(gaussY))
      gaussX += gaussVelX
      gaussY += gaussVelY
      gaussVelX += gaussAccX
      gaussVelY += gaussAccY

  applyGaussian: (g, radius, xCenter, yCenter) ->
    radius = Math.ceil(radius)
    for x in [xCenter - radius..xCenter + radius]
      for y in [yCenter - radius..yCenter + radius]
        if x >= 0 and x < @width and y >= 0 and y < @height
          @cells[x][y].altitude += g.get2d(x - xCenter, y - yCenter) * 100.0