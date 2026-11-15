
const rows = gapminderData.map(([country, region, year, life, pop, income]) =>
  ({country, region, year, life, pop, income}));
const comparisonCountries = ["United States", "Canada", "Venezuela", "Argentina", "Uruguay", "Cuba"];
const aggregateColor = "#53635d";
const countryPalette = [
  "#2369b2", "#b94226", "#148364", "#893a99", "#a66e00",
  "#007a98", "#c34d76", "#526c24", "#5647b5", "#91552d",
  "#d45410", "#286b4b", "#aa357d", "#315f76", "#787d12",
  "#843c42", "#367fae", "#69508c", "#217d7c", "#ae6316",
  "#434b82", "#a33655", "#597d3d", "#7e563d", "#ac599e"
];
const countries = [...new Set(rows.map(row => row.country))].sort();
const countryFilter = document.getElementById("country-filter");
const countryOptions = document.getElementById("country-options");
const countrySelection = document.getElementById("country-selection");
const resetCountries = document.getElementById("reset-countries");
for (const country of countries) {
  const option = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = country;
  option.append(checkbox,country);
  countryOptions.append(option);
}
const countryColors = new Map(countries.map((country, index) => [country, countryPalette[index]]));
const years = [...new Set(rows.map(row => row.year))].sort((a,b) => a-b);
const $ = id => document.getElementById(id);
const yearSelect = $("year");
const desktop = window.matchMedia("(min-width:900px) and (min-height:600px)");
yearSelect.value = years.at(-1);
const sum = data => data.reduce((total,row) => total + row.pop, 0);
const weighted = (data,key) => data.reduce((total,row) => total + row[key] * row.pop, 0) / sum(data);
const compact = (number, digits=2) => {
  if (number >= 1e9) return (number/1e9).toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") + "B";
  if (number >= 1e6) return (number/1e6).toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") + "M";
  if (number >= 1e3) return (number/1e3).toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") + "K";
  return String(number);
};
const dollars = n => "$" + Math.round(n).toLocaleString("en-US");
const ns = "http://www.w3.org/2000/svg";
function draw(parent, name, attrs, content) {
  const element = document.createElementNS(ns,name);
  for (const [key,value] of Object.entries(attrs)) element.setAttribute(key,value);
  if (content !== undefined) element.textContent = content;
  parent.append(element);
  return element;
}
function chart(id, defaultHeight, label) {
  const host = $(id);
  const width = Math.max(170,Math.floor(host.clientWidth));
  const height = desktop.matches ? Math.max(68, Math.floor(host.clientHeight)) : defaultHeight;
  host.replaceChildren();
  return {width, height, svg:draw(host,"svg",{viewBox:`0 0 ${width} ${height}`,role:"group","aria-label":label})};
}
function line(svg,x1,y1,x2,y2,attrs={}) {
  draw(svg,"line",{x1,y1,x2,y2,...attrs});
}
function label(svg,x,y,content,attrs={}) {
  return draw(svg,"text",{x,y,...attrs},content);
}
function scale(min,max,start,end) {
  return value => start + (value-min)/(max-min)*(end-start);
}
const tooltip = $("tooltip");
function point(element, description, keyboard=true) {
  element.classList.add("point");
  element.setAttribute("aria-label",description.replaceAll("\n",", "));
  if (keyboard) element.setAttribute("tabindex","0");
  draw(element,"title",{},description);
  function show(x,y) {
    tooltip.textContent = description;
    tooltip.hidden = false;
    tooltip.style.left = Math.max(4,Math.min(x+10,innerWidth-tooltip.offsetWidth-5))+"px";
    tooltip.style.top = Math.max(4,Math.min(y+12,innerHeight-tooltip.offsetHeight-5))+"px";
  }
  element.addEventListener("pointermove", event => show(event.clientX,event.clientY));
  element.addEventListener("pointerleave", () => tooltip.hidden = true);
  element.addEventListener("focus", () => {
    const bounds = element.getBoundingClientRect();
    show(bounds.left+bounds.width/2,bounds.top+bounds.height/2);
  });
  element.addEventListener("blur", () => tooltip.hidden = true);
  element.addEventListener("keydown", event => {
    if (event.key === "Escape") tooltip.hidden = true;
  });
}
function horizontalGrid(svg, ticks, left, right, y, format) {
  ticks.forEach(value => {
    line(svg,left,y(value),right,y(value),{class:"grid"});
    label(svg,left-8,y(value)+4,format(value),{"text-anchor":"end"});
  });
}
function labelBubbles(svg, bubbles, bounds, showAllLabels) {
  const leaders = draw(svg,"g",{class:"bubble-leaders","aria-hidden":"true"});
  const labels = draw(svg,"g",{class:"bubble-labels","aria-hidden":"true"});
  const occupied = bubbles.map(({cx,cy,r}) => ({
    x:cx-r-2,y:cy-r-2,width:2*r+4,height:2*r+4
  }));
  for (const {country,cx,cy,r,color} of bubbles) {
    if (!showAllLabels && !comparisonCountries.includes(country)) continue;
    const name = label(labels,0,0,country === "United States" ? "USA" : country);
    const width = name.getComputedTextLength()+4;
    const height = 13;
    let closest;
    let bestDistance = Infinity;
    for (let y = bounds.top; y+height <= bounds.bottom; y+=3) {
      for (let x = bounds.left; x+width <= bounds.right; x+=3) {
        const anchorX = Math.max(x,Math.min(cx,x+width));
        const anchorY = Math.max(y,Math.min(cy,y+height));
        const distance = Math.hypot(anchorX-cx,anchorY-cy);
        if (distance >= bestDistance || occupied.some(box =>
          x < box.x+box.width && x+width > box.x && y < box.y+box.height && y+height > box.y
        )) continue;
        closest = {x,y,width,height,anchorX,anchorY};
        bestDistance = distance;
      }
    }
    if (!closest) {
      name.remove();
      continue;
    }
    occupied.push(closest);
    name.setAttribute("x",closest.x+2);
    name.setAttribute("y",closest.y+10);
    if (bestDistance > r+4) {
      const ratio = r/bestDistance;
      line(leaders,cx+(closest.anchorX-cx)*ratio,cy+(closest.anchorY-cy)*ratio,
        closest.anchorX,closest.anchorY,{stroke:color});
    }
  }
}
function scatter(data,year,highlightSelection) {
  const {width, height, svg} = chart("scatter",340,`Income and life expectancy, ${year}`);
  const left = 42, right = width-16, top = 24, bottom = height-48;
  const x = scale(Math.log10(180),Math.log10(145000),left,right);
  const y = scale(15,90,bottom,top);
  label(svg,left,12,"Life expectancy (years)",{class:"axis-title"});
  horizontalGrid(svg,[20,30,40,50,60,70,80,90],left,right,y,String);
  const incomeTicks = width < 500 ? [300,1000,5000,20000,100000] : [300,600,1000,2000,5000,10000,20000,50000,100000];
  incomeTicks.forEach(value => {
    const tick = x(Math.log10(value));
    line(svg,tick,top,tick,bottom,{class:"grid"});
    label(svg,tick,bottom+18,"$"+compact(value,0),{"text-anchor":"middle"});
  });
  label(svg,(left+right)/2,(top+bottom)/2,year,{
    class:"year-watermark","text-anchor":"middle","dominant-baseline":"middle",
    "font-size":Math.min((right-left)*.27,(bottom-top)*.55),"aria-hidden":"true"
  });
  line(svg,left,bottom,right,bottom,{class:"baseline"});
  label(svg,(left+right)/2,height-5,"GDP per capita (log scale)",{"text-anchor":"middle",class:"axis-title"});
  const bubbles = [...data].sort((a,b) => b.pop-a.pop).map(row => {
    const color = countryColors.get(row.country);
    const cx = x(Math.log10(row.income));
    const cy = y(row.life);
    const r = Math.max(3,(width<500?18:30)*Math.sqrt(row.pop/302e6));
    const bubble = draw(svg,"circle",{
      cx,cy,r,
      fill:color,"fill-opacity":0.78,stroke:color,"stroke-width":0.8
    });
    point(bubble,`${row.country} · ${row.region}\nLife expectancy ${row.life.toFixed(1)} years\nGDP per capita ${dollars(row.income)}\nPopulation ${row.pop.toLocaleString("en-US")}`);
    return {country:row.country,cx,cy,r,color};
  });
  labelBubbles(svg,bubbles,{left,right,top,bottom},highlightSelection);
}
function lifeImprovement(data, baseline, year) {
  const {width,height,svg} = chart("life",235,`Life expectancy in 1952 and ${year}`);
  const startingLife = new Map(baseline.map(row => [row.country,row.life]));
  const comparisons = data.map(row => ({
    ...row, start:startingLife.get(row.country), gain:row.life-startingLife.get(row.country)
  })).sort((a,b) => b.gain-a.gain).slice(0,8);
  const left = Math.min(104,width*.4), right = width-15, bottom = height-24;
  const x = scale(30,90,left,right);
  [30,50,70,90].forEach(tick => {
    line(svg,x(tick),0,x(tick),bottom,{class:"grid"});
    label(svg,x(tick),bottom+15,tick,{"text-anchor":"middle"});
  });
  const pitch = Math.min(30,bottom/comparisons.length);
  comparisons.forEach(({country,start,life,gain},index) => {
    const cy = (index+.5)*pitch;
    const color = countryColors.get(country);
    const name = label(svg,left-7,cy+4,country,{"text-anchor":"end"});
    if (name.getComputedTextLength() > left-8) {
      name.setAttribute("textLength",left-8);
      name.setAttribute("lengthAdjust","spacingAndGlyphs");
    }
    line(svg,x(start),cy,x(life),cy,{stroke:color,"stroke-width":2,opacity:.55});
    draw(svg,"circle",{cx:x(start),cy,r:3.5,fill:"white",stroke:color,"stroke-width":1.5});
    const end = draw(svg,"circle",{cx:x(life),cy,r:4,fill:color});
    point(end,`${country}\n1952: ${start.toFixed(1)} years\n${year}: ${life.toFixed(1)} years\nChange: ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} years`);
  });
}
function incomeDistribution(data,year,color) {
  const {width,height,svg} = chart("distribution",235,`GDP per capita distribution in ${year}`);
  const left=22,right=width-17,top=11;
  const staggerTicks = (right-left)/9 < 32;
  const bottom = height-(staggerTicks ? 43 : 23);
  const interval=5000;
  const domain=45000;
  const buckets=Array.from({length:domain/interval},()=>0);
  data.forEach(row => buckets[Math.floor(row.income/interval)]++);
  const step=Math.max(1,Math.ceil(Math.max(...buckets)/3));
  const ceiling=Math.ceil(Math.max(...buckets)/step)*step;
  const ticks=Array.from({length:ceiling/step+1},(_,index)=>index*step);
  const x=scale(0,domain,left,right);
  const y=scale(0,ceiling,bottom,top);
  horizontalGrid(svg,ticks,left,right,y,String);
  for (let value = 0; value <= domain; value += interval) {
    const tick = x(value);
    const offset = staggerTicks && (value/interval)%2 ? 19 : 0;
    line(svg,tick,bottom,tick,bottom+4,{class:"baseline"});
    label(svg,tick,bottom+15+offset,"$"+compact(value,0),{"text-anchor":"middle"});
  }
  buckets.forEach((count,index) => {
    if (!count) return;
    const from=index*interval, to=from+interval;
    const bar=draw(svg,"rect",{
      x:x(from)+1,y:y(count),width:x(to)-x(from)-2,height:bottom-y(count),fill:color,rx:2
    });
    point(bar,`${dollars(from)} to under ${dollars(to)} · ${count} ${count===1?"country":"countries"}`);
  });
}
function bars(id,title,items,domain,format) {
  const {width,height,svg} = chart(id,280,title);
  const left = Math.min(120,width*.39), right=width-57, top=3;
  const pitch = Math.min(32, (height-5)/8);
  const barHeight = Math.min(21, pitch-2);
  const textOffset = barHeight/2+5;
  const x = scale(0,domain,left,right);
  line(svg,left,top,left,top+pitch*items.length,{class:"baseline"});
  items.forEach(({name,value,color},index) => {
    const y = top+index*pitch;
    const nameLabel = label(svg,left-8,y+textOffset,name,{"text-anchor":"end"});
    if (nameLabel.getComputedTextLength() > left-8) {
      nameLabel.setAttribute("textLength",left-8);
      nameLabel.setAttribute("lengthAdjust","spacingAndGlyphs");
    }
    const bar = draw(svg,"rect",{x:left,y:y+2,width:x(value)-left,height:barHeight,rx:3,fill:color});
    point(bar,`${name} · ${format(value)}`);
    label(svg,x(value)+6,y+textOffset,format(value),{class:"axis-title"});
  });
}
function render() {
  tooltip.hidden = true;
  const year = Number(yearSelect.value);
  $("year-value").value = year;
  const selected = new Set([...countryOptions.querySelectorAll("input:checked")].map(input => input.value));
  const country = selected.size === 1 ? selected.values().next().value : "";
  countrySelection.textContent = selected.size ? country || selected.size + " selected" : "All countries";
  resetCountries.disabled = selected.size === 0;
  const history = selected.size ? rows.filter(row => selected.has(row.country)) : rows;
  const data = history.filter(row => row.year === year);
  const baseline = history.filter(row => row.year === years[0]);
  const distributionColor = country ? countryColors.get(country) : aggregateColor;
  const averageNote = country || "Population-weighted average";
  $("rank-title").textContent = country ? "Life expectancy in " + country : "Longest life expectancy";
  $("income-title").textContent = country ? "GDP per capita in " + country : "Highest GDP per capita";
  $("rank-description").textContent = country ? year + " · Years" : (data.length > 8 ? "Top eight countries in " : "Selected countries in ") + year;
  $("income-description").textContent = country ? year + " · Inflation-adjusted US dollars" : (data.length > 8 ? "Top eight countries in " : "Selected countries in ") + year;
  const life = weighted(data,"life");
  const gain = life - weighted(baseline,"life");
  const stats = [
    ["Life expectancy",life.toFixed(1)+" years",averageNote],
    ["Change since 1952",(gain>0?"+":"")+gain.toFixed(1)+" years","Change in life expectancy"],
    ["GDP per capita",dollars(weighted(data,"income")),averageNote],
    ["Population",compact(sum(data)),country || `Across ${data.length} countries`]
  ];
  $("headlines").innerHTML = stats.map(([title,value,note]) =>
    `<article class="stat"><h2>${title}</h2><strong>${value}</strong><p>${note}</p></article>`).join("");
  scatter(data,year,selected.size > 0);
  $("improvement-description").textContent = (data.length > 8 ? "Eight largest gains · " : "") + "1952 ○ to " + year + " ● (years)";
  lifeImprovement(data,baseline,year);
  incomeDistribution(data,year,distributionColor);
  const ranking = [...data].sort((a,b) => b.life-a.life).slice(0,8).map(row =>
    ({name:row.country,value:row.life,color:countryColors.get(row.country)}));
  bars("rank",$("rank-title").textContent,ranking,90,n=>n.toFixed(1));
  const incomes = [...data].sort((a,b) => b.income-a.income).slice(0,8).map(row =>
    ({name:row.country,value:row.income,color:countryColors.get(row.country)}));
  bars("income",$("income-title").textContent,incomes,45000,dollars);
}
yearSelect.addEventListener("input",render);
countryOptions.addEventListener("change",render);
resetCountries.addEventListener("click",() => {
  for (const checkbox of countryOptions.querySelectorAll("input:checked")) checkbox.checked = false;
  countryFilter.querySelector("summary").focus();
  render();
});
document.addEventListener("click",event => {
  if (!countryFilter.contains(event.target)) countryFilter.open = false;
});
countryFilter.addEventListener("keydown",event => {
  if (event.key === "Escape" && countryFilter.open) {
    countryFilter.open = false;
    countryFilter.querySelector("summary").focus();
  }
});
window.addEventListener("resize",render);
render();
