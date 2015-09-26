var source = $("#object-list").html();
var template = Handlebars.compile(source);

var plist = $("#parent-list").html();
var plistTemplate = Handlebars.compile(plist);

var $uploadProgressBar = $("#upload-progress-bar");

var objects;
var objIndex;

function addParents(element) {
  var address = element.getAttribute("data-address");
  var parents = objects.filter(function(obj) {
    return obj.references && obj.references.indexOf(address) >= 0;
  });

  if (parents.length > 0) {
    var data = {
      objects: parents.sort(function(a, b) {
        return b.memsize - a.memsize;
      })
    };
    var innerTable = template(data);
    var newTr = plistTemplate({
      list: innerTable,
      "address": address
    });
    $(element).after(newTr);
  }
}

function toggleParents(element) {
  var address = element.getAttribute("data-address");
  var parents = $('*[data-parentsof="' + address + '"]');
  if (parents.length) {
    parents.toggle();
  } else {
    addParents(element);
  }
}

$('#obj-list').on('click', 'td', function() {
  toggleParents(this.parentElement);
});

Handlebars.registerHelper('trunc', function(str) {
  if (str) {
    return str.substring(0, 30);
  } else {
    return str;
  }
});

Handlebars.registerHelper('allocInfo', function(file, line) {
  if (file && line) {
    return file.substring(file.length - 30) + ":" + line;
  } else {
    return '';
  }
});

function objectsByType(objs) {
  var data = {};
  objs.forEach(function(obj) {
    if (obj.type) {
      if (!data[obj.type]) {
        data[obj.type] = [];
      }
      data[obj.type].push(obj);
    }
  });
  return data;
}

function objectsByGeneration(objs) {
  var data = {};
  objs.forEach(function(obj) {
    if (obj.generation) {
      if (!data[obj.generation]) {
        data[obj.generation] = [];
      }
      data[obj.generation].push(obj);
    }
  });
  return data;
}

function showTable(objs) {
  var data = {
    objects: objs.sort(function(a, b) {
      return b.memsize - a.memsize;
    })
  };
  $('#obj-list').html(template(data));
}


function getChartDimensions(chartSelector) {
  var $chart = $(chartSelector);

  return {
    // Get the width from the column (bootstrap col-*)
    width: $chart.parent().width(),

    // Get the height from charts-row elemnt
    height: $chart.parents('.charts-row').height()
  };
}

function renderCharts(objects) {
  // Show charts row, it's important to be here becuase dc.pieChart/dc.barChart/dc.*Chart
  // needs the elements to be shown :(
  $(".charts-row").show();

  var objectsCrossfilter = crossfilter(objects);


  // objects by type
  var objectsByTypeChart = dc.pieChart("#type-info");
  var typeDimension = objectsCrossfilter.dimension(function(obj) { return obj.type; });

  var typeChartDimensions = getChartDimensions("#type-info");

  // calculate the radius and the inner radius
  var diameter = Math.min(typeChartDimensions.height, typeChartDimensions.width),
      radius = diameter / 2,
      innerRadius = 0.3 * radius;

  objectsByTypeChart
       .width(typeChartDimensions.width)
       .height(typeChartDimensions.height)
       .radius(radius)
       .innerRadius(innerRadius)
       .dimension(typeDimension)
       .group(typeDimension.group())
       .title(function(d) {
         return d.data.key + " - " + d.data.value;
       })
       .label(function(d) {
         // Calculate the percentage of this type using the angles
         var pct = Math.round((d.endAngle - d.startAngle) / Math.PI * 50);
         return d.data.key + " - " + pct + '%';
       })
       .transitionDuration(500);


  // objects by generation
  var objectsGenerationChart = dc.barChart("#generation-info");
  var generationDimension = objectsCrossfilter.dimension(function(obj) { return obj.generation; });
  var generationGroup = generationDimension.group();

  var generationsChartDimensions = getChartDimensions("#generation-info");

  objectsGenerationChart
    .width(generationsChartDimensions.width)
    .height(generationsChartDimensions.height)
    .transitionDuration(500)
    .margins({top: 30, right: 50, bottom: 25, left: 40})
    .dimension(generationDimension)
    .group(generationGroup)
    .elasticY(true)
    .centerBar(true)
    .gap(1)
    .x(d3.scale.linear().domain(d3.extent(generationGroup.all(), function(o) { return o.key; })));



  dc.renderAll();
}

function updateFileProcessingProgressBar(percentageToCompletion) {
  var percentageText = percentageToCompletion + "%";
  $uploadProgressBar.show().find(".progress-bar")
    .attr("aria-valuenow", percentageToCompletion)
    .css("width", percentageText)
    .text(percentageText);

}

function readHeap(file) {
  var fileNavigator = new FileNavigator(file);

  objects = [];
  objIndex = {};

  // Start reading all files
  fileNavigator.readSomeLines(0, function linesReadHandler(err, index, lines, eof, progress) {
    updateFileProcessingProgressBar(progress);

    // Error happened
    if (err) {
      console.error("Error while reading files", err);
      return;
    }

    // Reading lines
    for (var i = 0; i < lines.length; i++) {
      var lineIndex = index + i;
      var line = lines[i];

      // Parse each line and add it to the index
      var obj = JSON.parse(line);
      objIndex[obj.address] = obj;
      objects.push(obj);
    }

    // End of file
    if (eof) {
      $("#instructions").hide();

      renderCharts(objects);

      return;
    }

    // Reading next chunk, adding number of lines read to first line in current chunk
    fileNavigator.readSomeLines(index + lines.length, linesReadHandler);
  });
}

document.querySelector('.readButton').addEventListener('click', function(e) {
  readHeap(document.getElementById('file').files[0]);
}, false);
