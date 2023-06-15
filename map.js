import MapView from "@arcgis/core/views/MapView.js";
import WebMap from "@arcgis/core/WebMap.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import ValuePicker from "@arcgis/core/widgets/ValuePicker.js";
import OAuthInfo from "@arcgis/core/identity/OAuthInfo.js";
import esriId from "@arcgis/core/identity/IdentityManager.js";

let highlights;

export const setupMap = (element) => {
  const infoCode = new OAuthInfo({
    appId: "fvYgDp4eRMEJ6KEG",
    flowType: "auto", 
    popup: false,
  });       
  esriId.registerOAuthInfos([infoCode]);
  const webmap = new WebMap({
    portalItem: {
      id: "af211c7a5eae4e6ba0c492e2eff25005",
    },
  });
  const view = new MapView({
    map: webmap,
    container: element,
  });
  view.map.add(new GraphicsLayer({
    id: 'graphics',
    effect: "bloom(1.5, 0.5px, 0.1)",
    opacity: 0.8    
  }));
  view.when(viewLoaded);
}

const viewLoaded = async (view) => {
  const layer = view.map.layers.find(layer => layer.type === 'feature');
  const layerView = await view.whenLayerView(layer);
  layerView.highlightOptions = {
    color: 'yellow'
  }
  const routes = await getRoutes(layer);
  const routePicker = getRoutePicker(routes);
  view.ui.add(routePicker, "top-right");
  const max = (await getMaxSequence(layer, routePicker)) / 10;
  const sequencePicker = getSequencePicker(max);
  view.ui.add(sequencePicker, "top-right");
  routePicker.watch("values", (values) => routeChanged(values, view, layer, sequencePicker, routePicker));
  sequencePicker.on("animate", () => animated(view, layer, layerView,  sequencePicker.values[0], routePicker.values[0], max));  
}

const getRoutePicker = (routes) => {
  const routePicker = new ValuePicker({
    component: {
      type: "combobox",
      placeholder: "Pick a route",
      items: routes,
    },
    values: ["NE1001"],
    visibleElements: {
      nextButton: false,
      playButton: false,
      previousButton: false,
    },
    caption: 'Select Route'
  });
  return routePicker;  
}

const getSequencePicker = (max) => {
  const sequencePicker = new ValuePicker({
    component: {
      type: "slider",
      min: 0,
      max: max,
      steps: getSteps(max),
      labels: getLabels(max)
    },
    values: [0],
    playRate: 300,
    visibleElements: {
      nextButton: false,
      previousButton: false
    },
    loop: true
  });
  return sequencePicker;
}

const routeChanged = async (values, view, layer, sequencePicker, routePicker) => {
  if (values.length) {
    layer.definitionExpression = `GARBAGE = '${values[0]}'`;
    const query = layer.createQuery();
    query.outSpatialReference = view.spatialReference;
    query.where = layer.definitionExpression;
    const max = (await getMaxSequence(layer, routePicker)) / 10;
    sequencePicker.component.max = max;
    sequencePicker.component.steps = getSteps(max);
    sequencePicker.component.labels = getLabels(max);
    sequencePicker.values = [0];
    sequencePicker.container.hidden = false;
    sequencePicker.play();
    const extent = await layer.queryExtent(query);
    highlights?.remove();
    view.goTo(extent);
  } else {
    layer.definitionExpression = 'GARBAGE is null';
    highlights?.remove();
    sequencePicker.container.hidden = true;
  }

}
const animated = async (view, layer, layerView, sequence, route, max) => {
  const query = layer.createQuery();
  query.where = `Sequence = ${sequence}*10 and GARBAGE = '${route}'`;
  query.returnGeometry = true;
  query.outSpatialReference = view.spatialReference;
  const result = await layer.queryFeatures(query);
  highlights = layerView.highlight(result.features);
  highlights?.remove();

  if (result.features.length) {
    const feature = result.features[0];
    feature.symbol = {
            type: 'simple-marker',
            size: 14,
            color: '#e27728',
            outline: {
                width: 0,
                color: '#e27728'
            }
        };
    const graphics = view.map.findLayerById('graphics');
    graphics.graphics.removeAll();
    graphics.graphics.add(feature);
    if (sequence === max - 1) {
      highlights?.remove();
    }
    if (!view.extent.contains(result.features[0].geometry)) {
      view.goTo({ target: result.features[0], zoom: view.zoom });
    }     
  }
   
}
const getSteps = (max) => {
  const steps = [];
  for (let i = 0; i < max; i++) {
    if (i % 1 === 0) {
      steps.push(i);
    }
  }
  return steps;
};
const getLabels = (max) => {
  const labels = [];
  for (let i = 0; i < max; i++) {
    if (i % 200 === 0) {
      labels.push(i);
    }
  }
  return labels;
};
const getMaxSequence = async (layer, routePicker) => {
  const query = layer.createQuery();
  query.where = `GARBAGE = '${routePicker.values[0]}'`;
  query.outFields = ["Sequence"];
  query.returnGeometry = false;
  query.orderByFields = ["Sequence desc"];
  query.num = 1;
  const result = await layer.queryFeatures(query);
  const max = result.features[0].getAttribute("Sequence");
  return max;
};
const getRoutes = async (layer) => {
  const query = layer.createQuery();
  query.where = "1=1";
  query.outFields = ["GARBAGE"];
  query.returnGeometry = false;
  query.orderByFields = ["GARBAGE"];
  query.returnDistinctValues = true;
  const result = await layer.queryFeatures(query);
  const routes = result.features.map((f) => {
    return {
      value: f.getAttribute("GARBAGE"),
      label: f.getAttribute("GARBAGE"),
    };
  });
  return routes;
};