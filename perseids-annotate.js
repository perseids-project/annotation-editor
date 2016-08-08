// TODO this all should be namespaced to remove global vars
var subref_start;
var subref_end;
var target_num = 1;
var body_num = 1;
var selected_target;
var selected_body;
var all_targets = new Hashtable();
var all_bodies = new Hashtable();
var inventories = {};
var body_span = [];
var repos = {};
var body_urn_parts = {};
var body_subref_start;
var body_subref_end;
var unsaved = false;
var tokens = { "body": [], "target": []};
  
var current_annotation_target = null;
var current_annotation_body = null;
var s_createAnnotationURL = null;
var s_getAnnotationURL = null;
var s_putAnnotationURL = null;
var s_passageTransform = null;
var s_annotationTransform = null;
var s_getInfoURL = null;
var s_exitURL = null;
var s_config = null;
var s_param = [];
var annotationXml;

// lang
// doc
// uri
// app
// header only parameteters
// getInfoURL
// getAnnotationURL
// putAnnotationURL
// passageTransformURL
// commentAnnotationURL ?


function Init(e_event,a_load) {

    // initialize defaults
    s_param["lang"] = 'default';
    s_param["app"] = 'editor';
    s_param["version"] = 'http://perseids.org/perseids-annotator#0.0.1'
    
    // get parameters from html metadata of form
    //  <meta name="perseids-param-<name>" content="<value>"/>
    var prefix = "perseids-param-";
    $("meta[name^='" + prefix + "']", document).each(
    function ()
    {
        var name = $(this).attr("name").substr(prefix.length);
        s_param[name] = $(this).attr("content");
    });

    // get parameters from call
    // Note: processed after parameters in metadata, so that
    // call parameters can override
    var callParams = location.search.substr(1).split("&");
    var numParams = callParams.length;
    for (i in callParams)
    {
        s_param[i] = callParams[i].split("=");
        s_param[s_param[i][0]] = s_param[i][1];
    }
    s_param["numParams"] = numParams;
    // get URLs from header
    s_peekURL =
        $("meta[name='perseids-peekURL']", document).attr("content");

    s_ctsEndpoint = 
        $("meta[name='perseids-ctsEndpoint']", document).attr("content");

    // get the peek info
    // eventually this will replace the info request and all other urls will come from here too
    var itemtype;
    $.ajax({
        dataType: "json",
        url: $("meta[name='perseids-peekURL']",document).attr("content").replace(/DOC_REPLACE/,s_param['doc']),
        async: false
    }).done( 
        function(data) {
            itemtype = data['type'].replace(/Identifier/,'');
        }
    ).fail(
        function(jqXHR, textStatus, errorThrown) { 
            var msg = "Can't get Service Info";
            alert(msg);
            throw(msg);
        }
    );

    s_getAnnotationURL =
        $("meta[name='perseids-getAnnotationURL']", document).attr("content").replace(/ITEMTYPE_REPLACE/,itemtype);
    s_putAnnotationURL =
        $("meta[name='perseids-putAnnotationURL']", document).attr("content").replace(/ITEMTYPE_REPLACE/,itemtype);
    s_createAnnotationURL = 
        $("meta[name='perseids-createAnnotationURL']", document).attr("content").replace(/ITEMTYPE_REPLACE/,itemtype);
    s_getInfoURL = 
        $("meta[name='perseids-getInfoURL']",document).attr("content").replace(/DOC_REPLACE/,s_param['doc']).replace(/ITEMTYPE_REPLACE/,itemtype);
    s_exitURL = 
        $("meta[name='perseids-exitURL']", document).attr("content").replace(/DOC_REPLACE/,s_param['doc']).replace(/ITEMTYPE_REPLACE/,itemtype);

    // get the configuration information
    // json object is expected to contain:
    //  tokenizer
    //  passage transform
    $.ajax({
        dataType: "json",
        url: s_getInfoURL,
        async: false
    }).done( 
        function(data) {
            s_config = data;
        }
    ).fail(
        function(jqXHR, textStatus, errorThrown) { 
            var msg = "Can't get Service Info";
            alert(msg);
            throw(msg);
        }
    );

    // add the motivations (hardcoded for now)
    s_config.motivations = [
        { "label" : "Has Translation", "value" : "oa:linking_translation" },
        { "label" : "Has Link", "value" : "oa:linking"},
        { "label" : "Has Identity","value" : "oa:identifying"},
        { "label" : "Has Classification", "value" : "oa:classifying"},
        { "label" : "Has Comment", "value" : "oa:commenting"},
        { "label" : "Is Fragment Of", "value" : "http://erlangen-crm.org/efrbroo/R15_has_fragment"},
        { "label" : "Has Fragment", "value" : "http://erlangen-crm.org/efrbroo/R15i_is_fragment_of"},
        { "label" : "Has Longer Version", "value" : "http://purl.org/saws/ontology#isLongerVersionOf"},
        { "label" : "Has Shorter Version", "value" : "http://purl.org/saws/ontology#isShorterVersionOf"},
        { "label" : "Has Variant", "value": "http://purl.org/saws/ontology#isVariantOf"},
        { "label" : "Is Verbatim Of", "value" : "http://purl.org/saws/ontology#isVerbatimOf"},
        { "label" : "Is Attributed To Author", "value":"http://purl.org/saws/ontology#isAttributedAuthorOf"},
        { "label" : "Has Member", "value":"http://purl.org/saws/ontology#isMemberOf"}
    ];

     $.ajax({
        dataType: "xml",
        url: s_config['passage_xslt'] || "./cts_annotate.xsl",
        async: false
    }).done( 
        function(data) {
            s_passageTransform = new XSLTProcessor();
            s_passageTransform.importStylesheet(data);   
        }
    ).fail(
        function(jqXHR, textStatus, errorThrown) { 
            var msg = "Can't get Passage XSLT";
            alert(msg);
            throw(msg);
        }
    );
    
    $.ajax({
        dataType: "xml",
        url: $("meta[name='perseids-annotationTransform']",document).attr("content"),
        async: false
    }).done( 
        function(data) {
            s_annotationTransform = new XSLTProcessor();
            s_annotationTransform.importStylesheet(data);   
        }
    ).fail(
        function(jqXHR, textStatus, errorThrown) { 
            var msg = "Can't get Annotation XSLT";
            alert(msg);
            throw(msg);
        }
    );
    
    // update the interface for the mode
    if (s_param['app'] == 'editor') {
        $('#save-button').show();
        $("#target_links").append(
            '<button id="new-button" onclick="ClickOnNew(event)">New Annotation</button>'
        );
        for (var type in s_config['target_links']) {
            var link_html = '';
            if (s_config['target_links'][type].length > 1) {
                link_html = link_html + '<li>'+ type + '<ul class="perseids_sub_menu">';
            }
            for (var i=0; i < s_config['target_links'][type].length; i++) {
                var target_param = s_config.target_links[type][i].target_param;
                var passthrough = s_config.target_links[type][i].passthrough;
                var href= decodeURIComponent(s_config.target_links[type][i]['href']);
                href=href.replace('&','&amp;')
                link_html = link_html +
                    '<li><a class="target_link" href="' + href + 
                    '" data-passthrough="' + (passthrough ? passthrough : '') + 
                    '" data-param="' + (target_param ? target_param : '') + '">' +
                    s_config['target_links'][type][i]['text'] + '</a></li>';
                
            }
            if (s_config['target_links'][type].length > 1) {
                link_html = link_html + '</ul></li>';
            }
            $("#target_links").append(link_html);
        }
        $("#target_links a.target_link").click(ClickOnTargetLink);
        $("#target_links").show();
    } else {
        $('#save-button').hide();
        $("#target_links").hide();
    }
    // update the interface from the config
    $("#annotation_motivation").html('');
    $.each(s_config.motivations,
        function() {
            $("#annotation_motivation").append(
                '<option value="' + this.value + '">' + this.label + '</option>');
        }
    );
    $("#add_target").click(function() { add_target(); return false; });
    $("#add_body").click(function() { add_body(); return false; });
    // now setup the body
    $("#body_repo").change(get_body_cts);
    get_repos();
    $('#group_urn').change(update_work_urns);
    $('#work_urn').change(update_version_urns);
    $('#version_urn').change(update_cite_info);
    $(".cts_selector_hint").click( 
        function() { 
            $("#cts_select_container").toggle('slow');
            if ($("#cts_select_container:visible").length == 1) {
                $(".add_body").show();
            } else {
                $(".add_body").hide();
            }
        });
    $("#cts_request_button").click( function() { return merge_cite_info(get_body_passage); } );
    $(".cite_selector_hint").click( 
      function() { 
        $("#cite_select_container").toggle('slow');
      });

    // set various values in html
    var exitForm = $("form[name='navigation-exit']", document);
    if (s_exitURL.length > 0) {
        var exitAction = s_exitURL;
        var exitLabel = $("meta[name='perseids-exitLabel']", document);
        exitForm.attr("action", exitAction);
        $("input[name='doc']", exitForm).attr("value", s_param["doc"]);
        $("button", exitForm).text(exitLabel.attr("content"));
    }
}

function InitAnnotation() {
    // clear the hashes of selected subrefs
    all_targets.clear();
    all_bodies.clear();

    // retrieve the annotation
    $(".target_uri").remove();
    var params = [];
        params["doc"] = s_param["doc"];
        params["app"] = s_param["app"];
        params["uri"] = s_param["uri"];
    var annotation = getContents(s_getAnnotationURL, params);
    if (annotation ==  null) {
        return;
    }
        
    if (typeof annotation =="string")
    {
        annotation = (new DOMParser()).parseFromString(annotation,"text/xml");
    }
    annotationXml = annotation;
    // update form and check to see if we have new passage(s)
    var reloadTarget = false;
    var reloadBody = false;
    var target_passages = [];
    var target_uris = [];
    var body_passages = [];
    var body_uris = [];
    
    $(".target_uri").parents(".uri_wrapper").remove();
    $(".body_uri").parents(".uri_wrapper").remove();
   
    $("hasTarget",annotation).each(
        function() {
            var uri = $(this).attr("rdf:resource");
            target_uris.push(uri);
            if (uri.match(/urn:cts/)) {
                // no subreferences
                var base = uri.replace(/@.*$/,'');
                target_passages.push(base);
                if (base != current_annotation_target) {
                    reloadTarget = true;
                }
                    
            } else {
                target_passages.push(uri);
                if (uri != current_annotation_target) {
                    reloadTarget = true;
                }
            }
        }
    );
    
    $.each(target_uris,
        function(a_i) {
           var index = a_i +1;
           all_targets.put('target_uri' + index,[]);
           if (a_i > 0) {
               $("#targets").append(
                   '<p class="uri_wrapper">' 
                   + '<input type="text" id="target_uri'  
                   + index + '" name="target_uri' + index +'" class="target_uri" value="' 
                   + this + '"/>' 
                   + '<button id="remove_target_uri' + index 
                   + '" class="remove_target_uri">Remove</button>'
                   + '</p>');           
           } else {
               $("#targets").append('<p class="uri_wrapper"><input type="text" id="target_uri' + index + '" name="target_uri' + index +'" class="target_uri" value="' + this + '"/></p>');
           }

        });
        
     $("hasBody",annotation).each(
        function() {
            var uri = $(this).attr("rdf:resource");
            body_uris.push(uri);
            if (uri.match(/urn:cts/)) {
                // no subreferences
                var base = uri.replace(/@.*$/,'');
                body_passages.push(base);
                if (base != current_annotation_body) {
                    reloadBody = true;
                }
                    
            } else {
                body_passages.push(uri);
                if (uri != current_annotation_body) {
                    reloadBody = true;
                }
            }
        }
    );
    
    if (body_uris.length > 0) {
     $.each(body_uris,
         function(a_i) {
            var index = a_i +1;
            all_bodies.put('body_uri' + index,[]);
            if (a_i > 0) {
                $("#bodies").append(
                   '<p class="uri_wrapper">'
                   + '<input type="text" id="body_uri' + index 
                   + '" name="body_uri' + index +'" class="body_uri" value="' + this + '"/>'
                   + '<button id="remove_body_uri' + index 
                   + '" class="remove_body_uri">Remove</button>' 
                   + '</p>');           
            } else {
                $("#bodies").append('<p class="uri_wrapper"><input type="text" id="body_uri' + index + '" name="body_uri' + index +'" class="body_uri" value="' + this + '"/></p>');
            }
 
         });
    } else {
        $("#bodies").append('<p class="uri_wrapper"><input type="text" id="body_uri1" name="body_uri1" class="body_uri" value=""/></p>');
    }
    $('.target_uri').keypress(function() { set_state(true);});
    $('.body_uri').keypress(function() { set_state(true);});
   
    // reload if we need to, otherwise just reset highlighting
    if (reloadTarget) {
        // for now only support a single base passage
        // TODO support multiple different base passages
        current_annotation_target = target_passages[0];
        get_target_passage();
    } else {
        toggle_highlight(false,['selected','highlighted'],null,'target');
    }
     // reload if we need to, otherwise just reset highlighting
    if (reloadBody) {
        get_body_passage();
    } else {
        toggle_highlight(false,['selected','highlighted'],null,'body');
    }
    $('.target_uri').click(select_target_input);
    $('.remove_target_uri').click(function() {return remove_target_input(this);}); 
    $('#target_content .token').mousedown(start_target);
    $('#target_content .token').mouseup(end_target);
    selected_target = $('#target_uri1').get(0);
    
    //body
    $('.body_uri').click(select_body_input);
    $('.remove_body_uri').click(function() {return remove_body_input(this);}); 
    $('#body_content .token').mousedown(start_body);
    $('#body_content .token').mouseup(end_body);
    selected_body = $('#body_uri1').get(0);
    var motivation = $("motivatedBy",annotation).attr("rdf:resource");
    $("#annotation_motivation").val(motivation);
    set_state(false);
    $("#annotation_motivation").val(motivation);
    $('#annotation_motivation').change(function() {set_state(true);});
}

function get_target_passage() {
    var passage_url = current_annotation_target;
    // if all we have is a cts urn, use the default cts endpoint
    if (passage_url.match(/^urn:cts:/)) {
      passage_url = s_ctsEndpoint.replace(/URN_REPLACE/,passage_url);
    }
    // get the language from the inventory
    var found_in_inv = false;
    for (u in repos.urispaces) {
        var uri_match = new RegExp("^" + u)
        if (passage_url.match(uri_match)) {
            found_in_inv = true;
            get_cts_inventory(repos.urispaces[u],function() {tokenize_passage(passage_url,repos.urispaces[u])});
            break;
        }
    }
    if (! found_in_inv) {
      tokenize_passage(passage_url,null);
    }
}

function tokenize_passage(passage_url,inventory) {   
    var lang;
    if (inventory) {
        loopall:
        for (tg in inventories[inventory]) {
            for (work in inventories[inventory][tg].works) {
                for (version in inventories[inventory][tg].works[work].editions) {
                    text =  inventories[inventory][tg].works[work].editions[version];
                    if (text) {
                        var urn_match = new RegExp(text.urn)
                        if (passage_url.match(urn_match)) {
                            lang = text.lang;
                            break loopall; 
                        }
                    }
                }
                for (version in inventories[inventory][tg].works[work].translations) {
                    text =  inventories[inventory][tg].works[work].editions[version];
                    if (text) {
                        var urn_match = new RegExp(text.urn)
                        if (passage_url.match(urn_match)) {
                            lang = text.lang;
                            break loopall; 
                        }
                    }
                }
            }
        }
    }
    if (!lang && s_param['lang']) {
        lang = s_param['lang'];
    }
    var tokenizer_cfg = s_config.tokenizer;
    var tokenizer_url;
    if (tokenizer_cfg[lang]) {
      tokenizer_url = tokenizer_cfg[s_param['lang']];
    } else {
      tokenizer_url = tokenizer_cfg['default'];
    }
    
    var request_url = tokenizer_url + encodeURIComponent(passage_url);
    
    $.get(request_url).done(
      function(a_data) {
        if (s_passageTransform != null) {
            var content = s_passageTransform.transformToDocument(a_data);
            var div = $("div#tei_body",content);
            if (div.length > 0) {
                set_content('target',div.get(0).innerHTML);
            } else {
                set_content('target','<div class="error">Unable to load the requested text.</div>')
            }
          } else {
          set_content('target',a_data);
        }
      }).fail(
        function(jqXHR, textStatus, errorThrown) {
          set_content('target', '<div class="error">Unable to load the requested text.</div>');
        }
      ); 
}
    
function add_target() {
    var next_target = ++target_num;
    input_name = 'target_uri' + next_target;
    $('#targets').append('<p class="uri_wrapper">' +
          '<input class="target_uri" type="text" id="' + input_name + '" name="' + input_name + '"/>' + 
          '<button class="remove_target_uri" id="remove_' + input_name + '">Remove</button></p>');
    selected_target = $("#" + input_name);
    $("#"+input_name).click(select_target_input).change(function() { set_state(true);});
    $("#"+input_name).keypress(function() { set_state(true);});
    $('#remove_' + input_name).click(function() { return remove_target_input(this);});
    $('#'+input_name).click();
    return false;
}
  
function add_body() {
    var next_body = ++body_num;
    input_name = 'body_uri' + next_body;
    $('#bodies').append('<p class="uri_wrapper">' +
          '<input class="body_uri" type="text" id="' + input_name + '" name="' + input_name + '"/>' + 
          '<button class="remove_body_uri" id="remove_' + input_name + '">Remove</button></p>');
    selected_body = $("#" + input_name);
    $("#"+input_name).click(select_body_input);
    $("#"+input_name).keypress(function() { set_state(true);});
    $('#remove_' + input_name).click(function() { return remove_body_input(this);});
    $('#'+input_name).click();
    return false;
}

function remove_target_input(to_remove) {
    --target_num;
    var target_input = $(to_remove).prev();
    var target_name = target_input.attr('name');
    $(target_input).remove();
    $(to_remove).remove();
    toggle_highlight(false,['highlighted'],[target_name],'target');
    all_targets.remove(target_name);
    // will trigger selection of current target
    // so that we don't still the one being removed is selected
    if (selected_target == target_input.get(0)) {
        $("#target_uri"+target_num).trigger("click");
    } else {
        // reset the highlighting for the remaining targets
        toggle_highlight(true,['highlighted'],null,'target');
    }
    set_state(true);
    return false;
}

function remove_body_input(to_remove) {
    --body_num;
    var body_input = $(to_remove).prev();
    var body_name = body_input.attr('name');
    $(body_input).remove();
    $(to_remove).remove();
    toggle_highlight(false,['highlighted'],[body_name],'body');
    all_bodies.remove(body_name);
    // will trigger selection of current body
    // so that we don't still the one being removed is selected
    if (selected_body == body_input.get(0)) {
        $("#body_uri"+body_num).trigger("click");
    } else {
        // reset the highlighting for the remaining bodies
        toggle_highlight(true,['highlighted'],null,'body');
    }
    set_state(true);
    return false;
}

  
function select_target_input() {
    if (selected_target == this) {
        return;
    }
    var last_target = selected_target;
    selected_target = this;
    if (last_target) {
      toggle_highlight(false,['selected'],[last_target.name],'target');
    }
    toggle_highlight(true,['selected'],[selected_target.name],'target')
    toggle_highlight(true,['highlighted'],null,'target');
}

function select_body_input() {
    if (selected_body == this) {
        return;
    }
    var last_body = selected_body;
    selected_body = this;
    if (last_body) {
      toggle_highlight(false,['selected'],[last_body.name],'body');
    }
    toggle_highlight(true,['selected'],[selected_body.name],'body')
    toggle_highlight(true,['highlighted'],null,'body');
}


function start_target() {
    if ($(this).hasClass('punc')) {
        subref_start = $(this).nextAll('.text');
    } else {
        subref_start = this;
    }  
    toggle_highlight(false,['highlighted','selected'],null,'target');
}
  
function end_target() {
    if ($(this).hasClass('punc')) {
      subref_end = $(this).previous('.text');
    } else {
      subref_end = this;
    }
    if (subref_start == null || subref_end == null) {
      //alert("Unable to identify the selected range. Please try your selection again.");
      return;
    }
    var start_ref = $(subref_start).attr('data-ref');
    var end_ref = $(subref_end).attr('data-ref')
    if (start_ref == null || end_ref == null) {
      //alert("Unable to read the selected range. Please try your selection again.");
      return;
    }
    var uri = $("#target_uri1").val().replace(/@.*$/,'') + "@" + start_ref;
    // no span needed if the start and end are the same
    if (end_ref != start_ref) {
      uri = uri + '-' + end_ref;
    }
    if (selected_target.value != uri) {
        selected_target.value = uri;
        set_state(true);
    }
    all_targets.put(selected_target.name,[subref_start,subref_end]);
    toggle_highlight(true,['highlighted'],null,'target');
    toggle_highlight(true,['selected'],[selected_target.name],'target');
}
  
  
function toggle_highlight(a_on,a_classes,a_elem,a_type) {
    var elems;  
    if (a_elem == null) {
      elems = (a_type == 'target' ? all_targets.keys() : all_bodies.keys());
    } else { 
      elems = a_elem;
    }
    var touched = {};
    for (var j=0; j<elems.length; j++) {
        var name= elems[j];
        if (!name) {
            continue;
        }
        var set = (a_type == 'target' ? all_targets.get(name): all_bodies.get(name));
        if (set && set != null) {
            var started = false;
            var done = false;
            for (var t=0; t<tokens[a_type].length; t++) {
                if (done) {
                    break;
                }
                if (! started) {
                    if ($(tokens[a_type][t]).attr("data-ref") == $(set[0]).attr("data-ref")) {
                        started = true;
                    } 
                }
                for (var k=0; k<a_classes.length; k++) {
                  if (started && a_on) {
                    $(tokens[a_type][t]).addClass(a_classes[k]);
                    touched[t] = true;
                  } else {
                    // if we have mulitple targets or bodies we don't want to
                    // undo selections from the others we already selected
                    if (! touched[t]) {
                        $(tokens[a_type][t]).removeClass(a_classes[k]);
                    }
                  }  
                }
                if ($(tokens[a_type][t]).attr("data-ref") == $(set[1]).attr("data-ref")) {
                    done = true;
                }
            } // end iteration of tokens
        } // end test on set definition
      } // end iterator on each target
}
  
function set_content(a_type,a_html) {
    $('#' + a_type + '_content').html(a_html);
    tokens[a_type] =  $('#' + a_type + '_content .token');
    var seen = {};
    for (var t=0; t<tokens[a_type].length; t++) {
        var text = $(tokens[a_type][t]).text();
        var index = 1;
        if (seen[text]) {
          index = ++seen[text];
        } else {
          seen[text] = index;
        }
        $(tokens[a_type][t]).attr("data-ref",text + "[" + index + "]");
    }
    
    if (a_type == 'target') {
        tokens[a_type].mousedown(start_target);
        tokens[a_type].mouseup(end_target);
    } else {
        tokens[a_type].mousedown(start_body);
        tokens[a_type].mouseup(end_body);
    }
    reset_content(a_type);
}
  
function reset_content(a_type) {
      $('.' + a_type + '_uri').each(
      function() {
        var uri = $(this).val();
        var u_match = uri.match(/^.*?urn:cts:(.*)$/)
        if (u_match != null) {
          var parts = u_match[1].split(/:/);
          if (parts.length == 3) {
            var r_match = parts[2].match(/^.*?@(.*)$/);
            var r_start;
            var r_end;
            if (r_match != null) {
              var r_parts = r_match[1].split(/-/);
              if (r_parts.length == 1) {
                r_start = r_parts[0];
                r_end = r_parts[0];
              } else if (r_parts.length == 2) {
                r_start = r_parts[0];
                r_end = r_parts[1];
              } else {
                r_start = r_parts;
                r_end = r_parts;
              }
              
              var span_start = $("#" + a_type + "_content .token.text[data-ref='" + r_start + "']");
              var span_end = $("#" + a_type + "_content .token.text[data-ref='" + r_end + "']");
              // highlight the tokens if able to find them
              if (span_start.length > 0 && span_end.length > 0) {
                if (a_type == 'target') {
                    all_targets.put(this.name,[span_start.get(0),span_end.get(0)]);
                } else {
                    all_bodies.put(this.name,[span_start.get(0),span_end.get(0)]);
                }
              }
            }
          }
        }
      }
    );
    toggle_highlight(true,['highlighted','selected'],null,a_type);
}
  
function merge_input(a_type) {
    var all = $('.' + a_type + '_uri');
    var valid = [];
    var invalid = [];
    all.each(
      function() { 
        if( $(this).val().match(/^(https?|urn:cts):/) != null ) {
          valid.push(this);
        }
      }
    );
    all.each(
      function() { 
        if($(this).val().match(/^(https?|urn:cts):/) == null) {
          invalid.push(this);
        }
      }
    );
    if (invalid.length == 0) {
      return valid;
    } else {
      // returning null indicates there were invalid targets
      return null;
    }
   
}
  
function submit_commentary_create() {
    var valid_targets = merge_input('target');
    var messages = [];
    if (null == valid_targets) {
       messages.push("You have one more more invalid annotation target uris specified.");
    } else if ( valid_targets.length == 0) {
      messages.push("You need to specify at least one valid uri as an annotation target.");
    }
    // TODO we need also to check that the target ranges don't overlap
    if (messages.length > 0) {
      alert(messages.join("\n"));
      return false;
    } else {
      $("#init_value").remove();
      valid_targets.each(
        function() {
          $('#commentary_form').append('<input name="init_value[]" type="hidden" value="' + $(this).val() + '""/>');
        });
      $('#commentary_form').submit();
      return false;
    }
}
  
function check_input() {
    var messages = [];
    var valid_targets = merge_input('target');
    if (null == valid_targets) {
       messages.push("You have one more more invalid annotation target uris specified.");
    } else if ( valid_targets.length == 0) {
      messages.push("You need to specify at least one valid uri as an annotation target.");
    }
    var valid_bodies = merge_input('body');    
    if (null == valid_bodies) {
      messages.push("You need to specify one or more valid uris as the annotation body.");
    } else if ( valid_bodies.length == 0) {
      messages.push("You need to specify at least one valid uri as an annotation body.");
    }
    // TODO we need also to check that the target rnages don't overlap
    if (messages.length > 0) {
      alert(messages.join("\n"));
      return false;
    } else {
      if (Array.isArray(valid_targets)) {
        $('#valid_targets').val($.map($(valid_targets),function(elem,i) { return $(elem).val(); }).join(' '));
      }
      else
      {
        $('#valid_targets').val($(valid_targets).val());
      }
      if (Array.isArray(valid_bodies)) {
        $('#valid_bodies').val($.map($(valid_bodies),function(elem,i) { return $(elem).val(); }).join(' '));
      }
      else
      {
        $('#valid_bodies').val($(valid_bodies).val());
      }
      return true;
    }
}
   
function confirm_delete() {
    return confirm("Are you sure you want to delete this annotation?");
}
  
  
function get_repos() {
    $.getJSON(s_config['cts_services']['repos']).done(
        function(a_data) {
            repos = a_data;
            InitAnnotation();
            populate_body_repo();
        }
    ).fail(
        function(jqXHR, textStatus, errorThrown) {
            var msg = "Can't get CTS Repositories";
            alert(msg);
            throw(msg);    
        }
    );
  }
  
function populate_body_repo() {
    update_body_urn_parts();
    $('#body_repo').append("<option value='-'>click to select...</option>");
    for (key in repos.keys) {
      var label = key;
      // if the repo is for the publication it will be all digits override the label
      if (label.match(/^\d+$/) ){
        label = "This Publication"
      }
      $('#body_repo').append("<option value='" + key + "'>" + label + "</option>");
    }
    $('#body_repo').children().each(
        function(){
            if($(this).val() == body_urn_parts.repos){
                $(this).prop('selected',true);
                get_body_cts();
                return false;
            }
       });
}

function get_body_cts() {
    var inventory = $('#body_repo option:selected').val();
    if (inventory == '-') {
        update_group_urns();
    } else if (inventories[inventory] == null) {
      get_cts_inventory(inventory,update_group_urns);
    } else {
      update_group_urns();
    }
}
  
function get_cts_inventory(inventory,callback) {
    var request_url = s_config['cts_services']['capabilities'] + inventory;

    $.getJSON(request_url).done(
        function(a_data) {
            inventories[inventory] = a_data;
            callback.call();
        }
    ).fail(
        function(jqXHR, textStatus, errorThrown) {
            var msg = "Can't get capabilities of " + inventory;
            alert(msg);
            throw(msg);    
        }
    );
}
   
function clear_selector(select_element) {
    $("option",select_element).remove();
}
  
function populate_selector(select_element,options,selected_value) {
    $("option",select_element).remove();
    var count = 0
    var sortable = [];
    for (var k=0; k<options.length; k++) {
      var obj = options[k]
      for (var i in obj)
      {
        if (obj[i].urn != null) {
          sortable.push([obj[i].urn,obj[i].label]);
        }
      }
    }
    sortable.sort(function(a,b) { 
      if (a[1] < b[1]) return -1;
      if (a[1] > b[1]) return 1;
      return 0;
    });
    for (var i=0; i<sortable.length; i++) {
        $(select_element).append("<option value='" + sortable[i][0] + "'>" + sortable[i][1] + "</option>");
    }
    count = sortable.length;
    if (count == 0) {
      $(select_element).prop('disabled',true);
      $(select_element).hide();
    } else {
        if (count > 1) {
            $(select_element).append("<option value=''>click to select...</option>");
        } 
        $(select_element).prop('disabled',false);
        $(select_element).show();
    }
    select_element.children().each(
        function(){
            if( $(this).val() == selected_value){
            $(this).prop('selected',true);
            return false;
        }
    });
}
  
function update_group_urns() {
    $('#cts_request_button').prop('disabled',true);
    clear_selector($('#version_urn'));
    clear_selector($('#work_urn'));
    var inventory = $('#body_repo option:selected').val();
    if (inventory == '-') {
        clear_selector($('group_urn'));
    } else {
        //  populate the textgroup selector
        var groups = inventories[inventory];
        populate_selector($('#group_urn'),[groups],body_urn_parts.textgroup);
        update_work_urns();
    }
}
  
function update_work_urns() {
    $('#cts_request_button').prop('disabled',true);
    clear_selector($('#version_urn'));
    // get the works for the selected textgroup and populate the work selector
    var inventory = $('#body_repo option:selected').val();
    var textgroup = $('#group_urn option:selected').val();
    if (textgroup) { 
        var works = inventories[inventory][textgroup].works;
        populate_selector($('#work_urn'),[works],body_urn_parts.work);
        update_version_urns();
    }
  }
  
function update_version_urns() {
    $('#cts_request_button').prop('disabled',true);
    // get the editions for the selected textgroup and work and populate the edition selector
    var inventory = $('#body_repo option:selected').val();
    var textgroup = $('#group_urn option:selected').val();
    var work = $('#work_urn option:selected').val();
    var editions = null;
    var translations = null;
    if (inventory && textgroup && work) {
        work = work.replace(textgroup+".",''); 
        editions = inventories[inventory][textgroup].works[work].editions
        translations = inventories[inventory][textgroup].works[work].translations
      
    }
    if (editions != null || translations != null) {
        populate_selector($('#version_urn'),[editions,translations],body_urn_parts.version)
    } else {
        // still need to empty it out
        populate_selector($('#version_urn'),[{}])
        $('#cts_request_button').prop('disabled',true);
    }
    update_cite_info();
}
  
function update_body_urn_parts() {
    // check to see if the pre-populated URI is from one of the registered repositories
    var body_uri = $(selected_body).val() || '';
    urn_match = body_uri.match(/^(.*?)\/(urn:cts:.*)$/)    
    if (urn_match != null) {
      urispace = urn_match[1];
      urn = urn_match[2];
      body_urn_parts.repos = repos.urispaces[urispace];
      // try again with the identifier if the end of the uri is digits because it might be from the pub
      if (! body_urn_parts.repos) {
        var match_pub = urispace.match(/^(.*?)\/\d+$/);
        if (match_pub) {
          body_urn_parts.repos = repos.urispaces[match_pub[1]];
        }
      }
      urn_parts = urn.split(':');
      version_parts = urn_parts[3].split('.');
      body_urn_parts.textgroup = urn_parts[2] + ':' + version_parts[0];
      body_urn_parts.work = urn_parts[2] + ':' + version_parts[0] + "." + version_parts[1];
      body_urn_parts.version = [urn_parts[0],urn_parts[1],urn_parts[2],urn_parts[3]].join(':');
      if (urn_parts.length == 5) {
        body_urn_parts.passage = urn_parts[4].split('@')[0];
      }
    } 
    else {
      body_urn_parts = {}; 
    }
  }
  
function update_cite_info() {
    // clear the #citeinfo div in the form
    $('#cts_request_button').prop('disabled',true);
    $('#citeinfo').html('');
    $('#cts_request_button').prop('disabled',true);
    // get the current edition and repo from the form input
    var inventory = $('#body_repo option:selected').val();
    var textgroup = $('#group_urn option:selected').val();
    var work = $('#work_urn option:selected').val();
    var version = null;
    if (inventory && textgroup && work) { 
        work = work.replace(textgroup+".",'');
        var version_urn = $('#version_urn').val();
        if (version_urn) {
            version = version_urn.match(/^.*?([^\.]+)$/)[1];
        }
        if (version != null) {
            // lookup citation labels from stored inventory data
            // for each citation level, add label and input to the #citeinfo div in the form
            var citeinfo = 
                (inventories[inventory][textgroup].works[work].editions != null && inventories[inventory][textgroup].works[work].editions[version] != null) ? 
                inventories[inventory][textgroup].works[work].editions[version].cites :
                (inventories[inventory][textgroup].works[work].translations != null &&
                inventories[inventory][textgroup].works[work].translations[version] != null) ? 
                inventories[inventory][textgroup].works[work].translations[version].cites : [];
              
            var range = body_urn_parts.passage ? body_urn_parts.passage.split('-') : [];
            var values = [];
            for (var i=0; i<range.length;i++) {
                values[i] = range[i].split('.');
            } 
            $('#citeinfo').append('<span class="cite_span_label">From:</span>');
          
            for (var i=0; i<citeinfo.length; i++) {
                var value = (values[0] != null && values[0].length == citeinfo.length) ? values[0][i] : '';
                $('#citeinfo').append(
                    '<label class="cite_from_label" for="cite_from' + i + '">' + citeinfo[i] + '</label>' +
                    '<input type="text" name="cite_from_' + i + '" class="cite_from" value="' + value +'"/>');
            }
            $('#citeinfo').append('<br/><span class="cite_span_label">To:</span>');
            for (var i=0; i<citeinfo.length; i++) {
                var value = (values[1] != null && values[1].length == citeinfo.length) ? values[1][i] : '';
                $('#citeinfo').append(
                    '<label class="cite_to_label" for="cite_to' + i + '">' + citeinfo[i] + '</label>' +
                    '<input type="text" name="cite_to_' + i + '" class="cite_to" value="' + value +'"/>');
            }
             $('#cts_request_button').prop('disabled',false);
         }
    } 
   
}

/**
 * Merges the individual components of the citation into the passage component 
 * of a CTS URN and validates that at least one component of the 
 * starting citation was supplied before submitting the form.
 * @param {Function} callback call upon successful merging of cite info
 */
function merge_cite_info(a_callback) {
    try {
    var start =  $.grep(
        $.map($('input.cite_from'),
        function(e,i) { 
            return e.value; 
        }),function(a,i) { return a.match(/[\w\d]+/) });
    if (start.length == 0 ) {
        alert("Please specify at least one level of the passage citation scheme.");
        return false;
    }
    var end = $.grep(
        $.map($('input.cite_to'),
        function(e,i) { 
            return e.value; 
        }),function(a,i) { return a.match(/[\w\d]+/) });
    if (end.length > 0 && end.length != start.length) {
      alert("Citation start and end must be at the same citation level.");
      return false;
    }
    var urispace = repos.keys[$('#body_repo option:selected').val()]
    // if the body resource is from the identifier repo, then append the right id
    var props = body_props_from_form();
    if (props.item_id) {
          urispace = urispace + '/' + props.item_id
    }
    var uri =  urispace + "/" + $('#version_urn option:selected').val() + ':' + start.join('.');
    if (end.length > 0 && end.join('.') != start.join('.')) {
        uri = uri + '-' + end.join('.');
    }
    var uri_match = new RegExp("^" + uri + '@');
    var old_uri_value = $(selected_body).val();
    // hack to prevent replacement of uri during board review
    if (!old_uri_value || (old_uri_value.match(uri_match) == null && s_param['app'] == 'editor')) {
        $(selected_body).val(uri);
        // make sure change event on uri element is triggered
        $(selected_body).trigger('change');
    }
    if (a_callback) {
        a_callback.call();
    }

    } catch (a_e) {
        console.log(a_e);
    }
    return false;
  }
  
function body_props_from_form() {
    var inventory = $('#body_repo option:selected').val();
    var textgroup = $('#group_urn option:selected').val();
    var work = $('#work_urn option:selected').val().replace(textgroup+".",''); 
    var version = $('#version_urn option:selected').val();
    var lookup_ver = version.match(/^.*?([^\.]+)$/)[1];
    var props = 
      (inventories[inventory][textgroup].works[work].editions != null &&
       inventories[inventory][textgroup].works[work].editions[lookup_ver] != null) ? 
      inventories[inventory][textgroup].works[work].editions[lookup_ver] : 
      (inventories[inventory][textgroup].works[work].translations != null &&
      inventories[inventory][textgroup].works[work].translations[lookup_ver] != null) ? 
      inventories[inventory][textgroup].works[work].translations[lookup_ver] : {};
    return props; 
}
  
function get_body_passage() {
    var passage =  $.grep(
        $.map($('input.cite_from'),
        function(e,i) { 
            return e.value; 
        }),function(a,i) { return a.match(/[\w\d]+/) }).join('.');    
    var end_range = $.grep(
        $.map($('input.cite_to'),
        function(e,i) { 
            return e.value; 
        }),function(a,i) { return a.match(/[\w\d]+/) }).join('.');
    if (end_range.length > 0) {
      passage = passage + '-' + end_range;
    }
    var inventory = $('#body_repo option:selected').val();
    var textgroup = $('#group_urn option:selected').val();
    var work = $('#work_urn option:selected').val();
    if (work) {
        work = work.replace(textgroup+".",''); 

        var version = $('#version_urn option:selected').val();
        if (version) {
            $('#body_content').html('<div class="loading">Loading...</div>');
            var lookup_ver = version.match(/^.*?([^\.]+)$/)[1];
            var props = 
              (inventories[inventory][textgroup].works[work].editions != null && inventories[inventory][textgroup].works[work].editions[lookup_ver] != null) ? 
              inventories[inventory][textgroup].works[work].editions[lookup_ver] : 
              (inventories[inventory][textgroup].works[work].translations != null && inventories[inventory][textgroup].works[work].translations[lookup_ver] != null) ? 
              inventories[inventory][textgroup].works[work].translations[lookup_ver] : {};
            var lang = props.lang || 'default';
            var request_inventory = props.item_id || inventory; 
        
            var passage_url = s_config['cts_services']['passage'] + request_inventory  + "/" + version + ":" + passage;
            
            var tokenizer_cfg = s_config.tokenizer;
            var tokenizer_url;
            if (tokenizer_cfg[lang]) {
              tokenizer_url = tokenizer_cfg[lang];
            } else {
              tokenizer_url = tokenizer_cfg['default'];
            } 
            var request_url = tokenizer_url + encodeURIComponent(passage_url);
            $.get(request_url).done(
              function(a_data) {
                // update the state var with the currently retrieved passage
                // TODO support multiple different base passages
                current_annotation_body = passage_url;
                if (s_passageTransform != null) {
                    var content = s_passageTransform.transformToDocument(a_data);
                    var div = $("div#tei_body",content);
                    if (div.length > 0) {
                        set_content('body',$(div).html());
                        $(".add_body").show();
                    } else {
                        set_content('body','<div class="error">Unable to transform the requested text.</div>')
                    }
                  } else {
                  set_content('body',a_data);
                }
                set_state(true);
              }).fail(
                function() {
                  set_content('body','<div class="error">Unable to load the requested text.</div>');
                }
              );
         }
    }
}
  
function start_body() {
    if ($(this).hasClass('punc')) {
        body_subref_start = $(this).nextAll('.text');
    } else {
        body_subref_start = this;
    }  
    toggle_highlight(false,['highlighted','selected'],null,'body');
}
  
function end_body() { 
    if ($(this).hasClass('punc')) {
      body_subref_end = $(this).previous('.text');
    } else {
      body_subref_end = this;
    }
    if (body_subref_start == null || body_subref_end == null) {
      //alert("Unable to identify the selected range. Please try your selection again.");
      return;
    }
    var start_ref = $(body_subref_start).attr('data-ref');
    var end_ref = $(body_subref_end).attr('data-ref')
    if (start_ref == null || end_ref == null) {
      //alert("Unable to read the selected range. Please try your selection again.");
      return;
    }
    body_span = [body_subref_start,body_subref_end];
   
    var uri = $("#body_uri1").val().replace(/@.*$/,'') + "@" + start_ref;
    // no span needed if the start and end are the same
    if (end_ref != start_ref) {
      uri = uri + '-' + end_ref;
    }
    if (selected_body.value != uri) {
        selected_body.value = uri;
        set_state(true);
    }
    all_bodies.put(selected_body.name,[body_subref_start,body_subref_end]);
    toggle_highlight(true,['highlighted'],null,'body');
    toggle_highlight(true,['selected'],[selected_body.name],'body');
}
  
function save_new() {
    // should call createAnnotationURL
    // get uri from response
    // update s_param[s]
    // call InitSentence
}

function set_state(a_unsaved) {
    unsaved = a_unsaved;
    adjust_buttons();
}

function unsaved_changes() {
    return unsaved;
}

function adjust_buttons() {
    if (unsaved_changes()) {
        $("#save-button").prop("disabled",false);
    } else {
        $("#save-button").prop("disabled",true);
    }
}
function ClickOnSave(a_evt)
{
    SaveContents(null);
};

function ClickOnNew(a_evt)
{
    // give user chance to save changes
    SaveContents("Save changes before continuing?");
    
    // setup an new annotation for this target
    // keep the first body reference and motivation only if the body is a CTS urn
    var body = $("#body_uri1").val();
    var motivation = $("#annotation_motivation option:selected").val();
    if (body.match(/urn:cts:/)) {
        body = body.replace(/@.*$/,''); 
    } else {
        body = '';
        motivation = '';
    }
    s_annotationTransform.setParameter(null, "e_targets", $("#target_uri1").val().replace(/@.*$/,''))
    
    s_annotationTransform.setParameter(null, "e_bodies", body);
    s_annotationTransform.setParameter(null, "e_motivation", motivation);
    s_annotationTransform.setParameter(null, "e_agentUri", s_param["version"]);
    var xml = s_annotationTransform.transformToDocument(annotationXml);
    var response = putContents(xml.documentElement,
                         s_createAnnotationURL,
                         s_param["doc"],
                         '');
    var uri = $(response).text();
    if (uri) {
        s_param['uri'] = encodeURIComponent(uri);
        InitAnnotation();
    } else {
        var msg = "Something went wrong - unable to retrieve URI of new annotation";
        alert(msg);
        throw(msg);
        return false;
    }
  
};

function ClickOnTargetLink() {
    var link = $(this);
    var valid_targets = merge_input('target');
    
    // give user chance to save changes
    SaveContents("Save changes before continuing?");
   
    if (null == valid_targets) {
       alert("You have one more more invalid annotation target uris specified.");
       return false;
    } else if ( valid_targets.length == 0) {
      alert("You need to specify at least one valid uri as an annotation target.");
      return false;
    }
    targets = $.map($(valid_targets),function(elem,i) { return $(elem).val(); })
    var url = link.attr("href");
    if (link.attr("data-param") != '') {
        // if a target parameter name was supplied, include all the targets as-is
        for (var i=0; i<targets.length; i++) {
            url = url + "&" + link.attr("data-param") + '=' + targets[i];
        }
    } else {
        // otherwise just append the first target for the passage to the url
        url = url + targets[0].replace(/@.*$/,'');
    }
    // if it's a pass through link, retrieve the contents and submit to the passthrough url
    var passthrough = $(this).attr("data-passthrough");
    if (passthrough.match(/^https?:\/\//)) {
        $.get(url)
         .done(
            function(a_data) {
                var response = putContents(a_data,
                         passthrough,
                         '',
                         '');
            }
         ).fail(
            function(jqXHR, textStatus, errorThrown) { 
                var msg = "Can't get data";
                alert(msg);
                throw(msg);
            }
         );
         $("#perseids-put-notice").removeClass("error").addClass("loading").html("Retrieving...");
         return false;
    } else {
        $(this).attr("href",url);
        return true;
    }
}

// save contents to database
function SaveContents(a_confirm)
{
    // validate
    if (check_input()) {
    // if need to confirm
    if (a_confirm)
    {
        // do nothing if no unsaved changes
        if (! unsaved)
            return;

        // do nothing if action not confirmed
        if (!confirm(a_confirm))
            return;
    }

    // transform sentence
    s_annotationTransform.setParameter(null, "e_targets", $("#valid_targets").val());
    s_annotationTransform.setParameter(null, "e_bodies", $("#valid_bodies").val());
    s_annotationTransform.setParameter(null, "e_motivation", $("#annotation_motivation option:selected").val());
    s_annotationTransform.setParameter(null, "e_agentUri", s_param["version"]);
    
    
       
    var xml = s_annotationTransform.transformToDocument(annotationXml);
    putContents(xml.documentElement,
                         s_putAnnotationURL,
                         s_param["doc"],
                         s_param["uri"]);

    // remember where we last saved and fix buttons
    set_state(false);
    adjust_buttons();
    return true;
    }
};

/**
 * Test that a supplied url has the same origin as the document
 * @param {String} a_url the url to test
 * @return true if the same origin, otherwise false 
 */
function sameOrigin(a_url) {
    // test that a given url is a same-origin URL
    // url could be relative or scheme relative or absolute
    var host = document.location.host; // host + port
    var protocol = document.location.protocol;
    var sr_origin = '//' + host;
    var origin = protocol + sr_origin;
    // Allow absolute or scheme relative URLs to same origin
    return (a_url == origin || a_url.slice(0, origin.length + 1) == origin + '/') ||
        (a_url == sr_origin || a_url.slice(0, sr_origin.length + 1) == sr_origin + '/') ||
        // or any other URL that isn't scheme relative or absolute i.e relative.
        !(/^(\/\/|http:|https:).*/.test(a_url));
}

/**
 * Put contents of annotation 
 * @param {Element} a_xml sentence to put
 * @param {String} a_url URL to send sentence to
 * @param {String} a_doc document name
 * @param {String} a_uri annotation uri
 */
function putContents(a_xml, a_url, a_doc, a_uri)
{
    // clear any old notice out
    $("#perseids-put-notice").html('');
    // if nothing has changed, do nothing
    // (shouldn't ever happen because save button should be disabled)
    // if uri is empty then we're doing a create rather than a save s
    // so no alert
    if (! unsaved_changes() && a_uri != '') {
        alert("No Changes to Save!")   
        return;
    }
    // send synchronous request to save
    var req = new XMLHttpRequest();
    var builtUrl = a_url.replace('DOC_REPLACE',a_doc);
    builtUrl = builtUrl.replace('URI_REPLACE',a_uri);
    req.open("POST", builtUrl, false);
    // check to see if we need to send a session token
    var sessionToken = $("meta[name='perseids-sessionTokenName']").attr("content");
    var sessionHeader = $("meta[name='perseids-sessionHeaderName']").attr("content");
    // Only send the token to same-origin, relative URLs only.
    if (sessionToken && sessionHeader && sameOrigin(builtUrl)) {
        var csrftoken = getCookie(sessionToken);
        // Only if we have the cookie
        if (csrftoken) {
            req.setRequestHeader(sessionHeader, csrftoken);
        }
    }
    req.setRequestHeader("Content-Type", "application/xml");
    req.send(new XMLSerializer().serializeToString(a_xml));
    if ((req.status != 200) || req.responseXML == null || $(req.responseXML.documentElement).is("error"))
    {
        var msg = "ERROR!! CHANGES NOT SAVED!<br/>"
        if (req.responseXML != null &&  $(req.responseXML.documentElement).is("error"))
        { 
            msg = msg + $(req.responseXML.documentElement).text();
        } else {
            msg = msg + "Error saving " + a_uri + " in " + a_doc;
        }
        msg = msg + ": " + (req.responseText ? req.responseText : req.statusText);
        $("#perseids-put-notice").addClass("error").text(msg);
        throw(msg);
    } else if (a_uri != '') {
        $("#perseids-put-notice").removeClass("error").removeClass("loading").html("Changes Saved!");
    } else if (a_doc != '') {
        $("#perseids-put-notice").removeClass("error").removeClass("loading").html("Annotation Created!");
    } else {
        $("#perseids-put-notice").removeClass("error").removeClass("loading").text(new XMLSerializer().serializeToString(req.responseXML));
    }
    return $(req.responseXML.documentElement);
}

/**
 * Get contents of sentence from database
 * @param {String} a_url URL to get sentence from
 * @param {Object} a_params array of parameters
 * @returns sentence
 * @type {Document}
 */
function getContents(a_url, a_params)
{
    // get treebank sentence
    var req = new XMLHttpRequest();
    var builtUrl = a_url.replace('DOC_REPLACE',a_params['doc']);
    builtUrl = builtUrl.replace('URI_REPLACE',a_params['uri']);
    builtUrl = builtUrl.replace('APP_REPLACE',a_params['app']);
    req.open("GET", builtUrl, false);
    
    req.send(null);
    var root = null;
    if (req.status == 200) {
        root = $(req.responseXML.documentElement);
    }
    if ((req.status != 200) || root == null || root.is("error"))
    {
        var msg = root.is("error") ? root.text() :
                                     "Error getting sentence (" +
                                       urlParams +
                                       "): " +
                                       (req.responseText ? req.responseText :
                                                           req.statusText);
        alert(msg);
        throw(msg);
    }

    return req.responseXML;
}


/**
 * Get a cookie with the supplied name
 * @param {String} name the cookie name
 * @return the value of the cookie or null if not found
 */
function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie != '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = $.trim(cookies[i]);
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) == (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/**
 * Event handler for exit form
 * @param {Element} a_form the form
 */
function SubmitExit(a_form)
{
    // give user chance to save changes
    SaveContents("Save changes before continuing?");
    return true;
};

function build_annotation() {
    var root = ""
    var annotation = (new DOMParser()).parseFromString(annotation,"text/xml");

}
