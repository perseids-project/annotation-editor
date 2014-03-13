var subref_start;
var subref_end;
var target_num = 1;
var current_target;
var all_targets = new Hashtable();
var current_annotation_target = null;
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
    //  <meta name="alpheios-param-<name>" content="<value>"/>
    var prefix = "alpheios-param-";
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
        $("meta[name='alpheios-getAnnotationURL']", document).attr("content");
    s_putAnnotationURL =
        $("meta[name='alpheios-putAnnotationURL']", document).attr("content");
    
    // get the configuration information
    // json object is expected to contain:
    //  tokenizer
    //  motivations
    //  passage transform
    $.ajax({
        dataType: "json",
        url: $("meta[name='alpheios-getInfoURL']",document).attr("content").replace(/DOC_REPLACE/,s_param['doc']),
        async: false
    }).done( 
        function(data) {
            s_config = data;
        }
    ).fail(
        function(req) { 
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
        function(req) { 
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
    InitAnnotation();
  
}

function InitAnnotation() {
    // retrieve the annotation
    $(".target_uri").remove();
    var params = [];
        params["doc"] = s_param["doc"];
        params["app"] = s_param["app"];
        params["s"] = s_param["s"];
    var annotation = AlphEdit.getContents(s_getAnnotationURL, params);
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
        function() {
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
    current_target.value = uri;
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