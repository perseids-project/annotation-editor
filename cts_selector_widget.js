/**
 * Javascript to activate the cts_selector_widget
 * TODO turn this into a real jQuery plugin
 */

/** 
 * TODO namespace global vars and make them configurable
 */

/**
 *  Holds configuration settings
 */
var s_config = {};

/**
 * Identifies element to receive the uri for the cts selection
 */
var selected_body;

/**
 * Triggers editor behavior
 */
var s_param = { 'app' : 'editor' };

$(document).ready(function() {

  selected_body = $("#text_uri");

  /**
   * Configure where to get the services
   */
  s_config['cts_services'] = {};
  s_config['cts_services']['repos'] = 
    $("meta[name='cts_repos_url']").attr("content");
  s_config['cts_services']['capabilities'] = 
    $("meta[name='cts_capabilities_url']").attr("content");

  /**
   * Trigger handlers on form elements
   */
  $("#body_repo").change(get_cts_inventory);
  get_repos();
  $('#group_urn').change(update_work_urns);
  $('#work_urn').change(update_version_urns);
  $('#version_urn').change(update_cite_info);
  $("#cts_request_button").click( function() { return merge_cite_info(); } );
  $(".cts_selector_hint").click( 
      function() { 
          $("#cts_select_container").toggle();
      });
});
