// TODO this all should be namespaced to remove global vars
var subref_start;
var subref_end;
var target_num = 1;
var current_target;
var all_targets = new Hashtable();
var inventories = {};
var body_span = [];
var repos = {};
var body_urn_parts = {};
var body_subref_start;
var body_subref_end;
var unsaved = false;
  
var current_annotation_target = null;
var s_createAnnotationURL = null;
var s_getAnnotationURL = null;
var s_putAnnotationURL = null;
var s_passageTransform = null;
var s_config = null;
var s_param = [];
// lang
// doc
// s
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
    s_getAnnotationURL =
        $("meta[name='perseids-getAnnotationURL']", document).attr("content");
    s_putAnnotationURL =
        $("meta[name='perseids-putAnnotationURL']", document).attr("content");
    s_createAnnotationURL = 
        $("meta[name='perseids-createAnnotationURL']", document).attr("content");

    
    // get the configuration information
    // json object is expected to contain:
    //  tokenizer
    //  motivations
    //  passage transform
    $.ajax({
        dataType: "json",
        url: $("meta[name='perseids-getInfoURL']",document).attr("content").replace(/DOC_REPLACE/,s_param['doc']),
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
     $.ajax({
        dataType: "xml",
        url: s_config['passage_xslt'],
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
    
    
    
    // update the interface from the config
    $("#annotation_motivation").html('');
    $.each(s_config.motivations,
        function() {
            $("#annotation_motivation").append(
                '<option value="' + this.value + '">' + this.label + '</option>');
        }
    );
    $("#add_target").click(function() { add_target(); return false; });
    // now setup the body
    $("#body_repo").change(get_cts_inventory);
    get_repos();
    $('#group_urn').change(update_work_urns);
    $('#work_urn').change(update_version_urns);
    $('#version_urn').change(update_cite_info);
    $(".cts_selector_hint").click( function() { $("#cts_select_container").toggle(); });
    $("#cts_request_button").click( function() { return merge_cite_info(); } );
    $(".cite_selector_hint").click( function() { $("#cite_select_container").toggle();});


    // set various values in html
    var exitForm = $("form[name='navigation-exit']", document);
    var exitURL = $("meta[name='perseids-exitURL']", document);
    if (exitURL.length > 0) {
        var exitAction = exitURL.attr("content").replace(/DOC_REPLACE/,s_param["doc"]);
        var exitLabel = $("meta[name='perseids-exitLabel']", document);
        exitForm.attr("action", exitAction);
        $("input[name='doc']", exitForm).attr("value", s_param["doc"]);
        $("button", exitForm).text(exitLabel.attr("content"));
    }
    
    InitAnnotation();
  
}

function InitAnnotation() {
    // retrieve the annotation
    $(".target_uri").remove();
    var params = [];
        params["doc"] = s_param["doc"];
        params["app"] = s_param["app"];
        params["s"] = s_param["s"];
    var annotation = getContents(s_getAnnotationURL, params);
    if (annotation ==  null) {
        return;
    }
        
    if (typeof annotation =="string")
    {
        annotation = (new DOMParser()).parseFromString(annotation,"text/xml");
    }
    // update form and check to see if we have a new target passage
    var reloadTarget = false;
    var target_passages = [];
    var target_uris = [];
    $("hasTarget",annotation).each(
        function() {
            var uri = $(this).attr("rdf:resource");
            target_uris.push(uri);
            if (uri.match(/urn:cts/)) {
                // no subreferences
                base = uri.replace(/@.*$/,'');
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
           $("#targets").append('<input type="text" id="target_uri' + index + '" name="target_uri' + index +'" class="target_uri" value="' + this + '"/>');
           if (a_i > 0) {
               $("#targets").append('<button id="remove_target_uri' + index + '" class="remove_target_uri">Remove</button>');           
           }

        });
        
    // reload if we need to, otherwise just reset highlighting
    if (reloadTarget) {
        // for now only support a single base passage
        // TODO support multiple different base passages
        current_annotation_target = target_passages[0];
        get_target_passage();
    }
    $('#target_uri1').click(select_target_input);
    $('.remove_target_uri').click(function() {remove_target_input();}); 
    $('#target_content .token').mousedown(start_target);
    $('#target_content .token').mouseup(end_target);
    current_target = $('#target_uri1').get(0);
    
    //body
    $('#body_content .token').mousedown(start_body);
    $('#body_content .token').mouseup(end_body);

}

function get_target_passage() {
    var passage_url = current_annotation_target;
   
    var tokenizer_cfg = s_config.tokenizer;
    var tokenizer_url;
    if (tokenizer_cfg[s_param['lang']]) {
      tokenizer_url = tokenizer_cfg[s_param['lang']].request_url;
    } else {
      tokenizer_url = tokenizer_cfg['default'].request_url;
    }
    
    var request_url = tokenizer_url + encodeURIComponent(passage_url);
    
    $.get(request_url).done(
      function(a_data) {
        if (s_passageTransform != null) {
            var content = s_passageTransform.transformToDocument(a_data);
            var div = $("div",content);
            if (div.length > 0) {
                set_target_content(div.get(0).innerHTML);
            } else {
                set_target_content('<div class="error">Unable to load the requested text.</div>')
            }
          } else {
          set_target_content(a_data);
        }
      }).fail(
        function(jqXHR, textStatus, errorThrown) {
          $('target_content').innerHTML = '<div class="error">Unable to load the requested text.</div>';
        }
      ); 
  }
    
function add_target() {
    var next_target = ++target_num;
    input_name = 'target_uri' + next_target;
    $('#targets').append('<br/>' +
          '<input class="target_uri" type="text" id="' + input_name + '" name="' + input_name + '"/>' + 
          '<button class="remove_target_uri" id="remove_' + input_name + '">Remove</button>');
    current_target = $("#input_name");
    $("#"+input_name).click(select_target_input);
    $('#remove_' + input_name).click(function() { return remove_target_input(this);});
    $('#'+input_name).click();
    return false;
  }
  
function remove_target_input(to_remove) {
    var target_input = $(to_remove).prev();
    var target_name = target_input.attr('name');
    $(target_input).remove();
    $(to_remove).remove();
    toggle_highlight(false,['selected','highlighted'],[target_name]);
    all_targets.remove(target_name);
    return false;
}
  
function select_target_input() {
    if (current_target == this) {
        return;
    }
    last_target = current_target;
    current_target = this;
    if (last_target) {
      toggle_highlight(false,['selected'],[last_target.name]);
    }
    toggle_highlight(true,['selected'],[current_target.name])
}
  
function start_target() {
    if ($(this).hasClass('punc')) {
        subref_start = $(this).nextAll('.text');
    } else {
        subref_start = this;
    }  
    toggle_highlight(false,['highlighted','selected']);
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
    if (current_target.value != uri) {
        current_target.value = uri;
        set_state(true);
    }
    all_targets.put(current_target.name,[subref_start,subref_end]);
    toggle_highlight(true,['highlighted']);
    toggle_highlight(true,['selected'],[current_target.name]);
}
  
  
function toggle_highlight(a_on,a_classes,a_targets) {
    var targets;  
    if (a_targets == null) {
      targets = all_targets.keys();
    } else { 
      targets = a_targets;
    }
    for (var j=0; j<targets.length; j++) {
        var name= targets[j];
        if (!name) {
            continue;
        }
        var set = all_targets.get(name);
        if (set && set != null) {
            for (var k=0; k<a_classes.length; k++) {
              if (a_on) {
                $(set[0]).addClass(a_classes[k]);
              } else {
                $(set[0]).removeClass(a_classes[k]);
              }  
            }
          var sibs = $(set[0]).nextAll();
          var done = false;
          if (set[0] != set[1]) {
            for (var i=0; i<sibs.length; i++) {
              if (done) {
                break;
              }
             for (var k=0; k<a_classes.length; k++) {
                  if (a_on) {
                    $(sibs[i]).addClass(a_classes[k]);
                  } else {
                    $(sibs[i]).removeClass(a_classes[k]);
                  }
                  if (sibs[i] == set[1]) {
                    done = true;
                  }
                } // end class iterator
            }  // end loop through siblings
          } // end test on set length
        } // end test on set definition
      } // end iterator on each target
}
  
function set_target_content(a_html) {
    var target = $('target_content');
    $('#target_content').html(a_html);
    $('#target_content .token').mousedown(start_target);
    $('#target_content .token').mouseup(end_target);
    reset_current_target();
}
  
function reset_current_target() {
      $('.target_uri').each(
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
              if (r_parts.length > 0) {
                r_start = r_parts[0];
                r_end = r_parts[1];
              } else {
                r_start = r_parts;
                r_end = r_parts;
              }
              
              //prototype is unreliable here - switch to $
              var span_start = $("#target_content .token.text[data-ref='" + r_start + "']");
              var span_end = $("#target_content .token.text[data-ref='" + r_end + "']");
              // highlight the tokens if able to find them
              if (span_start.length > 0 && span_end.length > 0) {
                all_targets.put(this.name,[span_start.get(0),span_end.get(0)]);
              }
            }
          }
        }
      }
    );
    toggle_highlight(true,['highlighted','selected']);
}
  
function merge_targets() {
    var all_targets = $('.target_uri');
    var valid_targets = [];
    var invalid_targets = [];
    all_targets.each(
      function() { 
        if( $(this).val().match(/^https?:/) != null ) {
          valid_targets.push(elem);
        }
      }
    );
    all_targets.each(
      function() { 
        if($(this).val().match(/^https?:/) == null) {
          invalid_targets.push(elem);
        }
      }
    );
    if (invalid_targets.length == 0) {
      return valid_targets;
    } else {
      // returning null indicates there were invalid targets
      return null;
    }
   
}
  
function submit_commentary_create() {
    var valid_targets = merge_targets();
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
    var valid_targets = merge_targets();
    if (null == valid_targets) {
       messages.push("You have one more more invalid annotation target uris specified.");
    } else if ( valid_targets.length == 0) {
      messages.push("You need to specify at least one valid uri as an annotation target.");
    }
    var valid_body = ( $('body_uri').val().match(/^https?:/) != null);
    
    if (! valid_body) {
      messages.push("You need to specify a valid uri as the annotation body.");
    }
    // TODO we need also to check that the target rnages don't overlap
    if (messages.length > 0) {
      alert(messages.join("\n"));
      return false;
    } else {
      if (Array.isArray(valid_targets)) {
        $('valid_targets').value = $(valid_targets).collect(function(elem) { return elem.name; }).join(',');
      }
      else
      {
        $('valid_targets').value = valid_targets.name;
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
                get_cts_inventory();
                return false;
            }
       });
  }
  
function get_cts_inventory() {
    var inventory = $('#body_repo option:selected').val();
    if (inventory == '-') {
        update_group_urns();
    // if we don't already have this inventory's data, retrieve it and populate the selector
    } else if (inventories[inventory] == null) {
        var request_url = s_config['cts_services']['capabilities'] + inventory;

        $.getJSON(request_url).done(
            function(a_data) {
                inventories[inventory] = a_data;
                update_group_urns();
            }
        ).fail(
            function(jqXHR, textStatus, errorThrown) {
                var msg = "Can't get capabilities of " + inventory;
                alert(msg);
                throw(msg);    
            }
        );
      }
      else {
        update_group_urns();
      }
}
   
function clear_selector(select_element) {
    $("option",select_element).remove();
}
  
function populate_selector(select_element,options,selected_value) {
    $("option",select_element).remove();
    var count = 0
    for (var k=0; k<options.length; k++) {
      var obj = options[k]
      for (var i in obj)
      {
        if (obj[i].urn != null) {
          $(select_element).append("<option value='" + obj[i].urn + "'>" + obj[i].label + "</option>");
          count++;
        }
      }
    }
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
    if (editions != null ) {
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
    var body_uri = $('#body_uri').val() || '';
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
    $('#citeinfo').html('');
    $('#cts_request_button').prop('disabled',true);
    // get the current edition and repo from the form input
    var inventory = $('#body_repo option:selected').val();
    var textgroup = $('#group_urn option:selected').val();
    var work = $('#work_urn option:selected').val();
    if (inventory && textgroup && work) { 
        work = work.replace(textgroup+".",'');
        var version = $('#version_urn').val().match(/^.*?([^\.]+)$/)[1];
        // lookup citation labels from stored inventory data
        // for each citation level, add label and input to the #citeinfo div in the form
        var citeinfo = 
            inventories[inventory][textgroup].works[work].editions[version] != null ? 
            inventories[inventory][textgroup].works[work].editions[version].cites :
            inventories[inventory][textgroup].works[work].translations[version] != null ? 
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
    }
    $('#cts_request_button').prop('disabled',false);
}
  
// Merges the individual components of the citation into the passage component of a CTS URN
// and validates that at least one component of the starting citation was supplied before
// submitting the form.
function merge_cite_info() {
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
        $.map($('input.cite_from'),
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
    if (end.length > 0) {
        uri = uri + '-' + end.join('.');
    }
    var uri_match = new RegExp("^" + uri + '@');
    var old_uri_value = $('#body_uri').val();
    // hack to prevent replacement of uri during board review
    if (!old_uri_value || (old_uri_value.match(uri_match) == null && s_param['app'] == 'editor')) {
        $('#body_uri').val(uri);
    }
    get_body_passage();
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
      inventories[inventory][textgroup].works[work].editions[lookup_ver] != null ? 
      inventories[inventory][textgroup].works[work].editions[lookup_ver] : 
      inventories[inventory][textgroup].works[work].translations[lookup_ver] != null ? 
      inventories[inventory][textgroup].works[work].translations[lookup_ver] : {};
    return props; 
}
  
function get_body_passage() {
    $('#body_content').html('<div class="loading">Loading...</div>');
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
    var work = $('#work_urn option:selected').val().replace(textgroup+".",''); 
    var version = $('#version_urn option:selected').val();
    var lookup_ver = version.match(/^.*?([^\.]+)$/)[1];
    var props = 
      inventories[inventory][textgroup].works[work].editions[lookup_ver] != null ? 
      inventories[inventory][textgroup].works[work].editions[lookup_ver] : 
      inventories[inventory][textgroup].works[work].translations[lookup_ver] != null ? 
      inventories[inventory][textgroup].works[work].translations[lookup_ver] : {};
    var lang = props.lang || 'default';
    var request_inventory = props.item_id || inventory; 

    var passage_url = s_config['cts_services']['passage'] + request_inventory  + "/" + version + ":" + passage;
    
    var tokenizer_cfg = s_config.tokenizer;
    var tokenizer_url;
    if (tokenizer_cfg[lang]) {
      tokenizer_url = tokenizer_cfg[lang].request_url;
    } else {
      tokenizer_url = tokenizer_cfg['default'].request_url;
    } 
    var request_url = tokenizer_url + encodeURIComponent(passage_url);

    $.get(request_url).done(
      function(a_data) {
        if (s_passageTransform != null) {
            var content = s_passageTransform.transformToDocument(a_data);
            var div = $("div",content);
            if (div.length > 0) {
                set_body_content(div.get(0).innerHTML);
            } else {
                set_body_content('<div class="error">Unable to transform the requested text.</div>')
            }
          } else {
          set_body_content(a_data);
        }
      }).fail(
        function() {
          $('target_content').innerHTML = '<div class="error">Unable to load the requested text.</div>';
        }
      );  
}
  
  
function start_body() {
    if ($(this).hasClass('punc')) {
        body_subref_start = $(this).nextAll('.text');
    } else {
        body_subref_start = this;
    }  
    toggle_body_highlight(false,['highlighted','selected']);
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
    var uri = $("#body_uri").val().replace(/@.*$/,'') + "@" + start_ref;
    // no span needed if the start and end are the same
    if (end_ref != start_ref) {
      uri = uri + '-' + end_ref;
    }
    $('#body_uri').val(uri);
    toggle_body_highlight(true,['highlighted']);
}
  
function toggle_body_highlight(a_on,a_classes) {  
    var set = body_span
    if (set && set != null && set.length > 0) {
        for (var j=0; j<a_classes.length; j++) {
            var name=a_classes[j];
            if (a_on) {
                $(set[0]).addClass(name);
            } else {
                $(set[0]).removeClass(name);
            }
        }
        var sibs = $(set[0]).nextAll();
        var done = false;
        if (set[0] != set[1]) {
            for (var i=0; i<sibs.length; i++) {
                if (done) {
                    break;
                }
                for (var j=0; j<a_classes.length; j++) {
                var name=a_classes[j];
                if (a_on) {
                    $(sibs[i]).addClass(name);
                } else {
                    $(sibs[i]).removeClass(name);
                }
                if (sibs[i] == set[1]) {
                    done = true;
                }
            }
            }
        } // end test on set length
    } // end test on set definition
}
  
function set_body_content(a_html) {
    var body = $('#body_content');
    $('#body_content').html(a_html);
    $('#body_content .token').mousedown(start_body);
    $('#body_content .token').mouseup(end_body);
    var uri = $('#body_uri').val() || '';
    var u_match = uri.match(/^.*?urn:cts:(.*)$/)
    if (u_match != null) {
        var parts = u_match[1].split(/:/);
        if (parts.length == 3) {
            var r_match = parts[2].match(/^.*?@(.*)$/);
            var r_start;
            var r_end;
            if (r_match != null) {
                var r_parts = r_match[1].split(/-/);
                if (r_parts.length > 0) {
                    r_start = r_parts[0];
                    r_end = r_parts[1];
                } else {
                    r_start = r_parts;
                    r_end = r_parts;
                }
                var span_start = $("#body_content .token.text[data-ref='" + r_start + "']");
                var span_end = $("#body_content .token.text[data-ref='" + r_end + "']");
                // highlight the tokens if able to find them
                if (span_start.length > 0 && span_end.length > 0) {
                    body_span = [span_start.get(0),span_end.get(0)];
                }
            }
        }
    }
    toggle_body_highlight(true,['highlighted']);
}

function save_new() {
    // should call createAnnotationURL
    // get uri from response
    // update s_param[s]
    // call InitSentence
}

function set_state(a_unsaved) {
    unsaved = true;
    adjust_buttons();
}

function unsaved_changes() {
    return unsaved;
}

function adjust_buttons() {
    if (unsaved_changes()) {
        $("#save_button").prop("disabled",false);
    } else {
        $("#save_button").prop("disabled",false);
    }
}
function ClickOnSave(a_evt)
{
    SaveContents(null);
};

// save contents to database
function SaveContents(a_confirm)
{
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
    // TODO

    putContents(xml.documentElement,
                         s_putSentenceURL,
                         s_param["doc"],
                         s_param["s"]);

    // remember where we last saved and fix buttons
    set_state(false);
    adjust_buttons();
    return true;
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
 * @param {String} a_sentid sentence id
 */
function putContents(a_xml, a_url, a_doc, a_sentid)
{
    // clear any old notice out
    $("#perseids-put-notice").html('');
    // if nothing has changed, do nothing
    // (shouldn't ever happen because save button should be disabled)
    if (! unsaved_changes()) {
        alert("No Changes to Save!")   
        return;
    }
    // send synchronous request to save
    var req = new XMLHttpRequest();
    var builtUrl = a_url.replace('DOC_REPLACE',a_doc);
    builtUrl = builtUrl.replace('S_REPLACE',a_sentid);
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
    req.send(XMLSerializer().serializeToString(a_xml));
    if ((req.status != 200) || req.responseXML == null || $(req.responseXML.documentElement).is("error"))
    {
        var msg = "ERROR!! CHANGES NOT SAVED!<br/>"
        if (req.responseXML != null &&  $(req.responseXML.documentElement).is("error"))
        { 
            msg = msg + $(req.responseXML.documentElement).text();
        } else {
            msg = msg + "Error saving sentence " + a_sentid + " in " + a_doc;
        }
        msg = msg + ": " + (req.responseText ? req.responseText : req.statusText);
        $("#perseids-put-notice").addClass("error").text(msg);
        throw(msg);
    } else {
        $("#perseids-put-notice").removeClass("error").html("Changes Saved!");
    }
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
    builtUrl = builtUrl.replace('S_REPLACE',(a_params['id'] ? a_params['id'] : a_params['s']));
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