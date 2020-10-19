import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.scss';
import * as d3 from 'd3';
import $ from 'jquery';
import Handlebars from 'handlebars';
import loadingElement from './components/loadingElement';
import getIcons from './components/icons';
import { randomInRange, waitElementAndClick } from './utils';
import slideUp from './icons/data-ocean/slideUp.svg';
import closedCompanyIcon from './icons/data-ocean/closed.svg';
import graphHtml from './graph.html';


const searchFormS = '#company-search-form';
const searchButtonS = '#company-search-btn';
const searchInputS = 'input#company-search';
const graphContainerS = '#graph';


const linkTypes = {
  owner: 'owner',
  beneficiary: 'beneficiary',
  head: 'head',
  family: 'family',
  business: 'business',
  personal: 'personal',
  unknown: 'unknown',
  inactive: 'inactive',
};

const filters = [
  { name: 'family', label: 'Родинні зв\'язки' },
  { name: 'personal', label: 'Особисті зв\'язки' },
  { name: 'business', label: 'Ділові зв\'язки' },
  { name: 'head', label: 'Директор' },
  { name: 'beneficiary', label: 'Бенефіціар' },
  { name: 'owner', label: 'Власник' },
  { name: 'pep', label: 'Публічні особи' },
  { name: 'person', label: 'Фізичні особи' },
];

const PEP = 'pep';
const COMPANY = 'company';

const themes = {
  DATA_OCEAN: 'data-ocean',
  ANT_AC: 'antac',
}

class PepCompanyScheme {
  constructor(options = {}) {
    this.theme = options.theme || 'data-ocean';
    this.icons = getIcons(options.icons, this.theme);
    this.apiHost = options.apiHost || '';
    this.token = options.token || '';
    this.ajaxHeaders = options.ajaxHeaders || {};

    this.width = options.width || 1900;
    this.height = options.height || 900;

    this.colors = {
      primary: '#3FA2F7',
      secondary: '#ADBCD9',
      root: '#4F4F4F',
      nodeHover: '#EBF6FE',
      ...options.colors,
    };

    this.linkColors = {
      [linkTypes.business]: '#F39200',
      [linkTypes.family]: '#FF47DD',
      [linkTypes.personal]: '#FF006B',
      [linkTypes.head]: '#1F4999',
      [linkTypes.beneficiary]: '#852500',
      [linkTypes.owner]: '#03A7EA',
      [linkTypes.unknown]: '#B6B6B6',
      [linkTypes.inactive]: '#B6B6B6',
      // [linkTypes.business]: '#fd7575',
      // [linkTypes.family]: '#6ac72b',
      // [linkTypes.personal]: '#d2a22b',
      // [linkTypes.head]: '#3865d9',
      // [linkTypes.beneficiary]: '#9325ba',
      // [linkTypes.owner]: '#3FA2F7',
      // [linkTypes.unknown]: '#7b7b7b',
      // [linkTypes.inactive]: '#adbcd9',
      ...options.linkColors,
    };

    this.linkLabels = {
      [linkTypes.owner]: 'Власник',
      [linkTypes.beneficiary]: 'Бенефіціар',
      [linkTypes.head]: 'Керівник',
      [linkTypes.business]: 'Ділові зв\'язки',
      [linkTypes.family]: 'Сімейні зв\'язки',
      [linkTypes.personal]: 'Особисті зв\'язки',
      [linkTypes.unknown]: 'Невідомо',
      ...options.linkLabels,
    };

    this.center = {
      x: this.width / 2,
      y: this.height / 3,
    };

    this.nodes = [];
    this.links = [];
    this.selectedNode = null;
    this.rootNodeId = null;
    this.scheme = {
      svg: null,
      node: null,
      link: null,
      simulation: null,
    };
    this.linkTypeByRelationship = new Map([
      // owner
      ['owner', linkTypes.owner],
      ['власник', linkTypes.owner],
      ['власність', linkTypes.owner],
      ['співвласник', linkTypes.owner],
      ['спільна власність', linkTypes.owner],
      ['спільна сумісна власність', linkTypes.owner],
      // beneficiary
      ['бенефіціарний власник', linkTypes.beneficiary],
      // head
      ['керівник', linkTypes.head],
      ['директор', linkTypes.head],
      // business
      ['ділові зв\'язки', linkTypes.business],
      // personal
      ['особисті зв\'язки', linkTypes.personal],
      ['особи, які спільно проживають', linkTypes.personal],
      ['пов\'язані спільним побутом і мають взаємні права та обов\'язки', linkTypes.personal],
      // family
      ['усиновлювач', linkTypes.family],
      ['падчерка', linkTypes.family],
      ['дід', linkTypes.family],
      ['рідний брат', linkTypes.family],
      ['мати', linkTypes.family],
      ['син', linkTypes.family],
      ['невістка', linkTypes.family],
      ['внук', linkTypes.family],
      ['мачуха', linkTypes.family],
      ['особа, яка перебуває під опікою або піклуванням', linkTypes.family],
      ['усиновлений', linkTypes.family],
      ['внучка', linkTypes.family],
      ['батько', linkTypes.family],
      ['рідна сестра', linkTypes.family],
      ['зять', linkTypes.family],
      ['чоловік', linkTypes.family],
      ['опікун чи піклувальник', linkTypes.family],
      ['дочка', linkTypes.family],
      ['свекор', linkTypes.family],
      ['тесть', linkTypes.family],
      ['теща', linkTypes.family],
      ['баба', linkTypes.family],
      ['пасинок', linkTypes.family],
      ['вітчим', linkTypes.family],
      ['дружина', linkTypes.family],
      ['свекруха', linkTypes.family],
    ]);
  }

  init() {
    this.fetchMeta();
    this.injectHtml();
    this.showMessage('Щоб розпочати роботу скористайтесь пошуком');
    this.registerEventListeners();
  }

  injectHtml() {
    const template = Handlebars.compile(graphHtml);
    const legendNodes = [
      { icon: this.icons.company.active, label: 'Підприємство' },
      { icon: this.icons.pep.active, label: 'Публічна особа' },
      { icon: this.icons.peoples.active, label: 'Фізична особа' },
    ];
    const legendLinks = [];
    Object.values(linkTypes).forEach((linkType) => {
      if (linkType in this.linkLabels) {
        legendLinks.push({ color: this.linkColors[linkType], label: this.linkLabels[linkType] });
      }
    });
    $('#root').html(template({
      icons: this.icons,
      themeDO: this.theme === themes.DATA_OCEAN,
      themeAA: this.theme === themes.ANT_AC,
      filters,
      legendNodes,
      legendLinks,
    }));
    $('.slide').html(slideUp);
  }

  fetchMeta() {
    $.ajax('static/meta.json', {
      async: false,
      cache: false,
      success: (data) => {
        this.apiHost = data.apiHost.replace(/\/$/, '');
        this.token = data.t;
        this.ajaxHeaders.Authorization = `Token ${data.t}`;
      },
    });
  }

  getUrl(endpoint, id = null) {
    if (id) {
      return `${this.apiHost}/api/${endpoint}${id}/`;
    }
    return `${this.apiHost}/api/${endpoint}`;
  };

  getUrlForType(type, id) {
    if (type === PEP) {
      return this.getUrl('pep/', id);
    } else if (type === COMPANY) {
      return this.getUrl('company/', id);
    } else {
      throw new Error(`wrong type - ${type}`);
    }
  }

  getIconForSearchResult(type) {
    if (type === PEP) {
      return this.icons.pep.active;
    } else if (type === COMPANY) {
      return this.icons.company.active;
    } else {
      throw new Error(`wrong type - ${type}`);
    }
  }

  entityToString(type, obj) {
    if (type === PEP) {
      return obj.fullname;
    } else if (type === COMPANY) {
      return `${obj.edrpou} - ${obj.name}`;
    } else {
      throw new Error(`wrong type - ${type}`);
    }
  }

  extractObjAndLinkData(linkDataWithObj, objField, linkTypeField) {
    const obj = { ...linkDataWithObj[objField] };
    const linkData = {
      ...linkDataWithObj,
      _type: linkDataWithObj[linkTypeField],
      [objField]: undefined,
    };
    return [obj, linkData];
  }

  parseNodesLinks(data, type) {
    let newRootNode;

    const addChildNode = (item, type, linkData = {}) => {
      const newNode = {
        ...item,
        _type: type,
        _opened: false,
        _root: false,
      };
      newNode.id = this.getIdForNode(newNode);
      this.tryPushChildNode(newRootNode, newNode, false, linkData);
    };

    const parseCompany = () => {
      newRootNode = {
        ...data,
        _type: type,
        _opened: true,
        _root: true,
        relationships_with_peps: undefined,
        founder_of: undefined,
        founders: undefined,
      };
      newRootNode.id = this.getIdForNode(newRootNode);
      this.nodes.push(newRootNode);

      data.founder_of.forEach((company) => {
        addChildNode(company, COMPANY, { _type: linkTypes.owner });
      });
      data.relationships_with_peps.forEach((linkWithPep) => {
        const [pep, linkData] = this.extractObjAndLinkData(linkWithPep, 'pep', 'relationship_type');
        addChildNode(pep, PEP, linkData);
      });
    };

    const parsePep = () => {
      newRootNode = {
        ...data,
        _type: type,
        _opened: true,
        _root: true,
        related_companies: undefined,
        from_person_links: undefined,
        check_companies: undefined,
      };
      newRootNode.id = this.getIdForNode(newRootNode);
      this.nodes.push(newRootNode);
      data.related_companies.forEach((linkWithCompany) => {
        const [company, linkData] = this.extractObjAndLinkData(linkWithCompany, 'company', 'relationship_type');
        addChildNode(company, COMPANY, linkData);
      });
      data.from_person_links.forEach((linkWithPerson) => {
        const [pep, linkData] = this.extractObjAndLinkData(linkWithPerson, 'to_person', 'to_person_relationship_type');
        addChildNode(pep, PEP, linkData);
      });
      data.check_companies.forEach((item) => {
        addChildNode(item, COMPANY, { _type: linkTypes.owner });
      });
    };
    type === COMPANY ? parseCompany() : parsePep();
  }

  pushIfNotExists(array, newItem) {
    const res = array.find(item => item.id === newItem.id);
    if (!res) {
      array.push(newItem);
      return true;
    }
    return false;
  }

  tryPushChildNode(d, newNode, reverseLink = false, linkData = {}) {
    if (d.id === newNode.id) {
      return;
    }
    const isNew = this.pushIfNotExists(this.nodes, newNode);
    if (isNew) {
      newNode.x = d.x;
      newNode.y = d.y;
      newNode._parent = d.id;
      newNode._opened = false;
    } else {
      const existingLink = this.links.find((link) => {
        const ids = [link.source.id, link.target.id];
        return ids.includes(d.id) && ids.includes(newNode.id);
      });
      if (existingLink) {
        return;
      }
    }
    const newLink = reverseLink ? {
      ...linkData,
      source: newNode.id,
      target: d.id,
      id: `${newNode.id}-${d.id}`,
      _parent: newNode.id,
    } : {
      ...linkData,
      source: d.id,
      target: newNode.id,
      id: `${d.id}-${newNode.id}`,
      _parent: d.id,
    };
    this.pushIfNotExists(this.links, newLink);
  }

  showMessage(message) {
    $(graphContainerS).empty();
    $(graphContainerS).append(`
    <div class="loading-container">
      <h4 class="text-secondary">
        ${message}
      </h4>
    </div>
  `);
  }

  handleSideBlockHeaderClick(e) {
    const slideIcon = ($iconEl) => {
      if ($iconEl.hasClass('slide-up')) {
        $iconEl.removeClass('slide-up');
        $iconEl.addClass('slide-down');
      } else if ($iconEl.hasClass('slide-down')) {
        $iconEl.removeClass('slide-down');
        $iconEl.addClass('slide-up');
      }
    };
    const el = $(e.currentTarget);
    const detailBody = el.siblings('.side-block-body');
    slideIcon(el.find('.slide'));
    if (detailBody.length) {
      if (detailBody.hasClass('show')) {
        detailBody.removeClass('show');
        detailBody.slideUp();
      } else {
        detailBody.addClass('show');
        detailBody.slideDown();
      }
    }
  }

  registerEventListeners() {
    $('.side-block-header').on('click', (e) => {
      this.handleSideBlockHeaderClick(e);
    });
    $(searchFormS).on('submit', (e) => {
      this.handleSearchFormSubmit(e);
    });
    $(document).on('click', '.search-result', (e) => {
      this.handleSearchResultClick(e);
    });
    $(document).on('click', 'a.js-open-company', (e) => {
      this.handleOpenCompany(e);
    });
  }

  showSearchResults(data, type) {
    const searchDropdown = $('.search-dropdown');
    const searchResults = searchDropdown.find('ul');
    searchResults.find('li.search-result').remove();

    $(document).one('click', () => {
      searchDropdown.removeClass('show');
    });

    data.forEach((item) => {
      searchResults.append(`
      <li class="list-group-item p-1 list-group-item-action search-result"
          data-id="${item.id}"
          data-type="${type}"
      >
        <div class="pr-3 p-2" >
          ${this.getIconForSearchResult(type)}
        </div>
        <div class="search-result__text ${type === PEP ? 'text-capitalize' : ''}">
          ${this.entityToString(type, item)}
        </div>
      </li>
    `);
    });
    searchDropdown.addClass('show');
  }

  startSearchLoading() {
    $(searchButtonS).prop('disabled', true);
    $(searchInputS).prop('disabled', true);
    $(searchButtonS).html(`
    <div class="spinner-border spinner-border-sm" role="status">
      <span class="sr-only">Loading...</span>
    </div>
  `);
  }

  endSearchLoading() {
    $(searchButtonS).prop('disabled', false);
    $(searchInputS).prop('disabled', false);
    $(searchButtonS).html(this.icons.other.search);
  }

  startLoading() {
    $(graphContainerS).empty();
    $(searchButtonS).prop('disabled', true);
    $(graphContainerS).append(
      `<div class="loading-container">${loadingElement}</div>`
    );
  }

  endLoading() {
    $(graphContainerS).empty();
    $(searchButtonS).prop('disabled', false);
  }

  handleSearchFormSubmit(e) {
    e.preventDefault();
    this.startSearchLoading();
    const value = $(searchInputS).val();

    let type = PEP;
    let data = { name_search: value };
    if (/^\d{8}$/.test(value)) {
      type = COMPANY;
      data = { edrpou: value };
    }

    $.ajax(this.getUrlForType(type), {
      headers: this.ajaxHeaders,
      data,
      success: (data) => {
        this.showSearchResults(data.results, type);
        this.endSearchLoading();
      },
      error: () => {
        this.endSearchLoading();
        this.showMessage('Сталась непередбачувана помилка');
      }
    });
  }

  handleSearchResultClick(e) {
    const type = $(e.currentTarget).data('type');
    const id = $(e.currentTarget).data('id');
    this.rootNodeId = this.getIdForNode({ _type: type, id });
    this.startLoading();
    $.ajax(this.getUrlForType(type, id), {
      headers: this.ajaxHeaders,
      success: (data) => {
        this.endLoading();
        this.nodes = [];
        this.links = [];
        this.parseNodesLinks(data, type);
        this.drawSimulation();
        waitElementAndClick(`#${this.rootNodeId}`);
        $('#node-detail').removeClass('d-none');
      },
      error: () => {
        this.endLoading();
        this.showMessage('Сталась непередбачувана помилка');
      }
    });
  }

  getIdForNode(d) {
    let prefix;
    if (d._type === COMPANY) {
      prefix = 'company-';
    } else if (d._type === PEP) {
      prefix = 'pep-';
    } else {
      throw new Error(`wrong type ${d._type}`);
    }
    return `${prefix}${d.id}`;
  }

  getIdFromNode(d) {
    return d.id.match(/-(\d+)$/)[1];
  }

  generateDataForArrows() {
    let arrowsData = [];
    Object.entries(this.linkColors).forEach(([name, value]) => {
      arrowsData.push({ variant: name, color: value, root: true });
      arrowsData.push({ variant: name, color: value, root: false });
    });
    return arrowsData;
  }

  drawSimulation() {
    let i = 0;
    this.scheme.node = null;
    this.scheme.link = null;

    $(graphContainerS).empty();
    this.scheme.svg = d3.select(graphContainerS).append('svg')
      .attr('height', '100%')
      .attr('width', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .call(d3.zoom()
        // .scaleExtent([1 / 2, 8])
        .on('zoom', (e, d) => this.zoomed(e, d))
      )
      .append('g');


    this.scheme.svg.append("defs").selectAll("marker")
      .data(this.generateDataForArrows())      // Different link/path types can be defined here
      .enter()
      .append("svg:marker")    // This section adds in the arrows
      .attr("id", (d) => `arrow-${d.variant}-${d.root ? 'r' : 's'}`)
      .attr("viewBox", "2 -5 9 10")
      .attr("refX", (d) => {
        if (d.variant === 'inactive') {
          return d.root ? 52 : 42;
        }
        return d.root ? 38 : 31;
      })
      .attr("refY", 0)
      .attr("markerWidth", (d) => d.variant === 'inactive' ? 8 : 12)
      .attr("markerHeight", (d) => d.variant === 'inactive' ? 8 : 12)
      .attr("markerUnits", 'userSpaceOnUse')
      .attr("orient", "auto")
      .append("svg:path")
      .attr("d", "M0,-5L12,0L0,5")
      .attr('fill', (d) => d.color);

    this.scheme.linksG = this.scheme.svg.append("g").attr("class", "links");
    this.scheme.nodesG = this.scheme.svg.append("g").attr("class", "nodes");

    this.scheme.simulation = d3.forceSimulation()
      .force('link', d3.forceLink()
        .id((d) => d.id)//.distance(150)
        .distance((d) => {
          if (!d.distance) {
            d.distance = randomInRange(250, 150);
          }
          return d.distance;
        })
      )
      .force('charge', d3.forceManyBody().strength(-70))
      .force('center', d3.forceCenter(this.center.x, this.center.y))
      .force('collision', d3.forceCollide((d) => d._root ? 32 : 24))
      // .alphaDecay(0.001)
      .alphaDecay(0.01)
      .on('tick', (e, d) => this.ticked(e, d));

    this.update();
  }

  addTransition(d, delay = 0) {
    d.transition()
      .delay(delay)
      .duration(1000)
      .ease(d3.easeLinear)
      .style("opacity", 1);
  }

  hideCount(d) {
    return !d.founder_of_count || d._opened ? true : null;
  }

  getLinkTypeForLink(d) {
    if (this.linkTypeByRelationship.has(d._type)) {
      return this.linkTypeByRelationship.get(d._type);
    }
    return linkTypes.unknown;
  }

  markerEnd(link, selectedNode) {
    let arrowId;
    let srcId;
    let dstId;
    if (typeof link.source === 'string') {
      srcId = link.source;
      dstId = link.target;
    } else {
      srcId = link.source.id;
      dstId = link.target.id;
    }
    if (srcId === selectedNode.id) {
      arrowId = `arrow-${this.getLinkTypeForLink(link)}-`;
    } else {
      arrowId = 'arrow-inactive-';
    }
    if (dstId === this.rootNodeId) {
      arrowId += 'r';
    } else {
      arrowId += 's';
    }
    return `url(#${arrowId})`;
  }

  ticked(e, d) {
    this.scheme.link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);
    // .attr('x2', (d) => calculateX(d.target.x, d.target.y, d.source.x, d.source.y, 25))
    // .attr('y2', (d) => calculateY(d.target.x, d.target.y, d.source.x, d.source.y, 25));

    // link.attr("d", function (d) {
    //   let dx = d.target.x - d.source.x;
    //   let dy = d.target.y - d.source.y;
    //   let dr = Math.sqrt(dx * dx + dy * dy);
    //   return "M" +
    //     d.source.x + "," +
    //     d.source.y + "A" +
    //     dr + "," + dr + " 0 0,1 " +
    //     d.target.x + "," +
    //     d.target.y;
    // });

    this.scheme.node
      .attr('transform', (d) => {
        return `translate(${d.x}, ${d.y})`;
      });
  }

  renderCompanyDetail(company) {
    const $detail = $('#detail-block');
    $detail.empty();

    const founders = company.founders.map((founder) => {
      if (founder.id_if_company) {
        const founderNodeId = this.getIdForNode({ id: founder.id_if_company, _type: COMPANY });
        const companyNodeId = this.getIdForNode({ id: company.id, _type: COMPANY });
        const isNodeExists = this.nodes.find((node) => founderNodeId === node.id);
        const isLinkExists = isNodeExists && this.links.find((link) => (
          link.source.id === founderNodeId && link.target.id === companyNodeId
        ));
        if (isLinkExists) {
          return `<li>${founder.name} ${founder.edrpou || ''}</li>`;
        }
        return (
          `<li>
            <a href="${this.getUrl('company/', founder.id_if_company)}" class="js-open-company">
              ${founder.name} ${founder.edrpou || ''}
            </a>
          </li>`
        );
      }
      if (founder.name.split(' ').length === 3) {
        return `<li class="text-capitalize">${founder.name}</li>`;
      }
      return `<li>${founder.name}</li>`;
    });

    const founder_of = company.founder_of.map((comp) => {
      return `<li>${comp.name}</li>`;
    });

    const getHeadSigner = (company) => {
      const head = company.signers.find((person) => / - керівник/.test(person));
      if (head) {
        return `<span class="text-capitalize">${head.split(' - ')[0]}</span>`;
      } else {
        return 'невідомо';
      }
    };
    $detail.append(`
      <div class="node-name">${company.name}</div>
      <div class="detail__prop">${company.short_name}</div>
      <div class="detail__prop">
        <span class="prop-name">Статус:</span> ${company.status}
      </div>
      <div class="detail__prop">
        <span class="prop-name">ЄДРПОУ:</span> ${company.edrpou}
      </div>
      <div class="detail__prop">
        <span class="prop-name">Адреса:</span> ${company.address || ''}
      </div>
      <div class="detail__prop">
        <span class="prop-name">Статутний капітал:</span>
        ${company.authorized_capital ? company.authorized_capital.toLocaleString() : 'невідомо'}
      </div>
      <div class="detail__prop">
        <span class="prop-name">Керівник:</span> 
        ${getHeadSigner(company)}
      </div>
      <div class="prop-name">Засновники:</div>
      <div class="detail__prop">
        <ul style="padding-left: 20px">${founders.join('')}</ul>
      </div>
      <div class="prop-name">Є засновником:</div>
      <div class="detail__prop">
        <ul style="padding-left: 20px">${founder_of.join('')}</ul>
      </div>
    `);
  }

  renderPepDetail(pep) {
    const $detail = $('#detail-block');
    $detail.empty();

    let related_companies = pep.related_companies.map((rel_company) => {
      return `<li>
           <div><u>${rel_company.relationship_type}</u></div>
           <div>${rel_company.company.name} (${rel_company.company.edrpou})</div>
        </li>`;
    });
    let related_persons = pep.from_person_links.map((relation) => {
      const rel_person = relation.to_person;
      return `<li>
           <div><u>${relation.to_person_relationship_type}</u></div>
           <div class="text-capitalize">${rel_person.fullname}</div>
        </li>`;
    });
    let check_companies = pep.check_companies.map((company) => {
      return `<li>
           ${company.name} (${company.edrpou})
        </li>`;
    });
    $detail.append(`
      <div class="node-name">${pep.fullname}</div>
      <div>${pep.is_pep ? 'Є публічним діячем' : 'Не є публічним діячем'}</div>
      <div class="detail__prop">
        <span class="prop-name">Остання посада:</span> ${pep.last_job_title}
      </div>
      <div class="detail__prop">
        <span class="prop-name">Останнє місце роботи:</span> ${pep.last_employer}
      </div>
      <div class="detail__prop">
        <span class="prop-name">Тип:</span> ${pep.pep_type}
      </div>
      <div class="prop-name">Пов'язані компанії:</div>
      <div class="detail__prop">
        <ul style="padding-left: 20px">${related_companies.join('')}</ul>
      </div>
      <div class="prop-name">Пов'язані особи:</div>
      <div class="detail__prop">
        <ul style="padding-left: 20px">${related_persons.join('')}</ul>
      </div>
      <div class="prop-name">Можливі зв'язки з компаніями:</div>
      <div class="detail__prop">
        <ul style="padding-left: 20px">${check_companies.join('')}</ul>
      </div>
    `);
  }

  nodeClick(e, d) {
    if (e.defaultPrevented) {
      return;
    }
    this.selectedNode = d;
    this.scheme.svg.selectAll('.node')
      .style('stroke', (d) => this.nodeDefaultColor(d))
      .style('fill', (d) => this.nodeDefaultColor(d));

    d3.select(e.currentTarget.closest('g'))
      .style('fill', this.colors.primary)
      .style('stroke', this.colors.primary);

    this.scheme.svg.selectAll('.node-image')
      .html((d_node) => {
        if (d_node === d) {
          if (d._type === PEP) {
            if (d.is_pep) {
              return this.icons.pep.active;
            }
            return this.icons.peoples.active;
          }
          return this.icons.company.active;
        }
        return this.nodeDefaultImage(d_node);
      });


    // svg.selectAll('.link').exit().remove();
    this.scheme.svg.selectAll('.link')
      .attr("marker-end", (d_link) => this.markerEnd(d_link, d))
      .style('stroke', (d_link) => this.linkColor(d_link, d))
      .style('stroke-width', (d_link) => this.linkWidth(d_link, d));
    const $detail = $('#detail-block');
    $detail.empty();
    $detail.append(
      `<div class="side-block-l-container">${loadingElement}</div>`
    );
    $.ajax(this.getUrlForType(d._type, this.getIdFromNode(d)), {
      headers: this.ajaxHeaders,
      success: (data) => {
        if (d._type === COMPANY) {
          if (!d._opened) {
            this.increaseSimulationSpeed();
            this.addNewChildNodes(d, data.founder_of, COMPANY, (company) => {
              return [company, { _type: linkTypes.owner }];
            });
            this.addNewChildNodes(d, data.relationships_with_peps, PEP, (linkWithPep) => {
              return this.extractObjAndLinkData(linkWithPep, 'pep', 'relationship_type');
            });
          }
          this.renderCompanyDetail(data);
        } else if (d._type === PEP) {
          if (!d._opened) {
            this.increaseSimulationSpeed();
            this.addNewChildNodes(d, data.from_person_links, PEP, (linkWithPep) => {
              return this.extractObjAndLinkData(linkWithPep, 'to_person', 'to_person_relationship_type');
            });
            this.addNewChildNodes(d, data.related_companies, COMPANY, (linkWithCompany) => {
              return this.extractObjAndLinkData(linkWithCompany, 'company', 'relationship_type');
            });
            this.addNewChildNodes(d, data.check_companies, COMPANY, (company) => {
              return [company, { _type: linkTypes.owner }];
            });
          }
          this.renderPepDetail(data);
        } else {
          throw new Error(`wrong type ${d._type}`);
        }
        d._opened = true;
        this.scheme.svg.selectAll('.child-count')
          .attr('hidden', this.hideCount);
        this.update(d);
      }
    });
  }

  addNewChildNodes(d, items, type, getObjAndLink) {
    items.forEach((item) => {
      const [object, linkData] = getObjAndLink(item);
      const newNode = {
        ...object,
        _type: type,
      };
      newNode.id = this.getIdForNode(newNode);
      this.tryPushChildNode(d, newNode, false, linkData);
    });
  }

  linkColor(d, d_selected) {
    const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
    return sourceId === d_selected.id ? this.linkColors[this.getLinkTypeForLink(d)] : this.linkColors.inactive;
  }

  linkWidth(d, d_selected) {
    const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
    return sourceId === d_selected.id ? 2 : 1;
  }

  nodeDefaultColor(d) {
    return d._root ? this.colors.root : this.colors.secondary;
  }

  nodeDefaultImage(d) {
    if (d._type === COMPANY) {
      return d._root ? this.icons.company.root : this.icons.company.inactive;
    } else if (d._type === PEP) {
      if (d.is_pep) {
        return this.icons.pep.inactive;
      }
      return this.icons.peoples.inactive;
    } else {
      throw new Error(`Not supported type - ${d._type}`);
    }
  }

  nodeRightClick(e, d) {
    e.preventDefault();
    if (d._root) return;

    const removeLinks = [];
    const removeNodes = [];

    function removeChildNodesRecursive(d_node) {
      this.links.forEach((link) => {
        if (d_node === link.source) {
          if (link.target._linksCount < 2) {
            removeChildNodesRecursive(link.target);
            removeNodes.push(link.target);
          }
          removeLinks.push(link);
          d_node._linksCount -= 1;
          if (d_node._linksCount < 1) {
            removeNodes.push(d_node);
          }
        }
      });
    }

    removeChildNodesRecursive(d);

    this.links = this.links.filter((link) => !removeLinks.includes(link));
    this.nodes = this.nodes.filter((node) => !removeNodes.includes(node));

    $('.popover').remove();

    d._opened = false;
    this.scheme.svg.selectAll('.child-count')
      .attr('hidden', this.hideCount);

    this.update(d);
  }

  nodeHover(e, d) {
    if (!e.defaultPrevented) {
      d3.select(e.currentTarget).select('circle')
        .style('fill', this.colors.nodeHover);
    }
  }

  nodeBlur(e, d) {
    if (!e.defaultPrevented) {
      d3.select(e.currentTarget).select('circle')
        .style('fill', '#fff');
    }
  }

  increaseSimulationSpeed() {
    this.scheme.simulation.alpha(0.01);
    let a = 0.1;
    let int = setInterval(() => {
      if (a === 0.7) {
        clearInterval(int);
        return;
      }
      this.scheme.simulation.alpha(a);
      a += 0.1;
    }, 100);
  }

  dragStarted(e, d) {
    if (!e.active) this.scheme.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  dragged(e, d) {
    d.fx = e.x;
    d.fy = e.y;
  }

  dragEnded(e, d) {
    if (!e.active) this.scheme.simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  flatten(root) {
    const nodes = [];

    function recurse(node) {
      if (node.children) node.children.forEach(recurse);
      if (!node.id) node.id = ++i;
      else ++i;
      nodes.push(node);
    }

    recurse(root);
    return nodes;
  }

  zoomed(e) {
    this.scheme.svg.attr('transform', e.transform);
  }

  update(d = { id: null }) {
    // const nodes = flatten(root);
    // const links = root.links();
    this.scheme.link = this.scheme.linksG
      .selectAll('.link')
      .data(this.links, (d) => d.id);

    this.scheme.link.exit().remove();

    const linkEnter = this.scheme.link
      .enter()
      .append('line')
      .attr("marker-end", (d_link) => this.markerEnd(d_link, d))
      .attr('class', 'link')
      .style('opacity', 0)
      .style('stroke', (d_link) => this.linkColor(d_link, d))
      .style('stroke-width', (d_link) => this.linkWidth(d_link, d));
    // .on('mouseenter', lineHover)
    // .on('mouseleave', lineBlur);

    this.addTransition(linkEnter, 1000);

    this.scheme.link = linkEnter.merge(this.scheme.link);

    this.scheme.node = this.scheme.nodesG
      .selectAll('.node')
      .data(this.nodes, d => d.id);

    this.scheme.node.exit().remove();

    const nodeEnter = this.scheme.node
      .enter()
      .append('g')
      .attr('id', (d) => d.id)
      .attr('class', 'node')
      .style('opacity', 0)
      .style('stroke', (d) => this.nodeDefaultColor(d))
      .style('fill', (d) => this.nodeDefaultColor(d))
      .on('mouseenter', (e, d) => this.nodeHover(e, d))
      .on('mouseleave', (e, d) => this.nodeBlur(e, d))
      .on('click', (e, d) => this.nodeClick(e, d))
      .on('contextmenu', (e, d) => this.nodeRightClick(e, d))
      .call(d3.drag()
        .on('start', (e, d) => this.dragStarted(e, d))
        .on('drag', (e, d) => this.dragged(e, d))
        .on('end', (e, d) => this.dragEnded(e, d))
      );

    this.addTransition(nodeEnter);

    nodeEnter.append('circle')
      .attr("r", (d) => d._root ? 32 : 24)
      .style('cursor', 'pointer')
      .style('stroke-width', 2)
      .style('fill', '#fff');

    nodeEnter.append('rect')
      .attr('x', -7)
      .attr('y', -32)
      .attr('width', 14)
      .attr('height', 14)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('class', 'child-count')
      .style('stroke-width', 0)
      .style('cursor', 'pointer');

    let nodeIconGroup = nodeEnter.append('svg')
      .attr('x', (d) => d._root ? -22 : -16)
      .attr('y', (d) => d._root ? -24 : -18)
      .style('cursor', 'pointer')
      .append('g')
      .attr('transform', (d) => d._root ? 'scale(1.4)' : null);

    nodeIconGroup.append('g')
      .attr('class', 'node-image')
      .style('transform', 'translate(0px, 1px)')
      .html((d) => this.nodeDefaultImage(d));

    nodeIconGroup.append('g')
      .style('transform', 'translate(-1px, 18px)')
      .style('stroke-width', 0)
      .style('display', (d) => d.is_closed ? undefined : 'none')
      .html(closedCompanyIcon);

    nodeEnter.append('text')
      // .attr('hidden', hideCount)
      // TODO: replace text hardcode
      .text((d) => d.founder_of_count || 0)
      .attr('class', 'child-count')
      .attr('x', 0)
      .attr('y', -22)
      .style('stroke-width', 0)
      .style('stroke', '#fff')
      .style('fill', '#fff')
      .style('text-anchor', 'middle')
      .style('font-size', 10)
      .style('cursor', 'pointer');
    // .on('click', nodeClick);

    // svg.selectAll('.child-count')
    //   .style('display', (d) => d.children && d.children.length ? "none" : undefined);

    this.scheme.node = nodeEnter.merge(this.scheme.node);
    this.scheme.simulation.nodes(this.nodes);
    this.scheme.simulation.force('link').links(this.links);

    this.nodes.forEach((d) => {
      let count = 0;
      this.links.forEach((link) => {
        if ([link.source.id, link.target.id].includes(d.id)) {
          count += 1;
        }
      });
      d._linksCount = count;
    });

    d3.selectAll('svg .node').each(function (d, i) {
      let content;
      if (d._type === PEP) {
        content = `<div class="company-name text-capitalize">${d.fullname}</div>` +
          `<div>${d.is_pep ? 'Є публічним діячем' : 'Не є публічним діячем'}</div>` +
          `<div><b>Тип:</b> ${d.pep_type || ' --- '}</div>` +
          `<div><b>Посада:</b> ${d.last_job_title || ' --- '}</div>`;

      } else if (d._type === COMPANY) {
        content = `<div class="company-name">${d.short_name || d.name}</div>` +
          `<div>${d.company_type || ' --- '}</div>` +
          `<div><b>ЄДРПОУ:</b> ${d.edrpou || ' --- '}</div>` +
          `<div><b>Статус:</b> ${d.status || ' --- '}</div>`;
      }
      $(this).popover({
        trigger: 'hover',
        title: d.name || d.fullname,
        placement: 'top',
        html: true,
        content: content,
        template: '<div class="popover" role="tooltip">' +
          // '<div class="arrow"></div>' +
          // '<h3 class="popover-header"></h3>' +
          '<div class="popover-body popover-primary"></div>' +
          '</div>'
      });
    });
    this.scheme.svg.selectAll('.child-count')
      .attr('hidden', (d) => this.hideCount(d));
  }

  handleOpenCompany(e) {
    e.preventDefault();
    $(e.currentTarget).closest('li').html($(e.currentTarget).text());
    $.ajax(e.currentTarget.href, {
      headers: this.ajaxHeaders,
      success: (data) => {
        this.increaseSimulationSpeed();
        const newNodes = data.founder_of;
        delete data.founder_of;
        data._opened = true;
        data._type = COMPANY;
        data.id = this.getIdForNode(data);
        if (this.selectedNode.id !== data.id) {
          const isNew = this.pushIfNotExists(this.nodes, data);
          if (isNew) {
            data.x = this.selectedNode.x;
            data.y = this.selectedNode.y;
            // data._parent = selectedNode.id;
          }
        }
        // tryPushChildNode(selectedNode, data);
        this.addNewChildNodes(data, newNodes, COMPANY, (company) => {
          return [company, { _type: linkTypes.owner }];
        });
        this.update(data);
        waitElementAndClick(`#${data.id}`);
      },
      // error: () => {
      //   // endSearchLoading();
      //   // showMessage('Сталась непередбачувана помилка');
      // }
    });
  }
}

window.PepCompanyScheme = PepCompanyScheme;

$(function () {
  const visualization = new PepCompanyScheme();
  visualization.init();
});

// function lineHover(e, d) {
//   if (!e.defaultPrevented) {
//     d3.select(this)
//       .style('stroke-width', 2)
//       .style('stroke', colors.primary);
//   }
// }
//
// function lineBlur(e, d) {
//   if (!e.defaultPrevented) {
//     d3.select(this)
//       .style('stroke-width', 1)
//       .style('stroke', colors.secondary);
//   }
// }
