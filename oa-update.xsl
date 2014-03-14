<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:oa="http://www.w3.org/ns/oa#"
    xmlns:oax="http://www.w3.org/ns/openannotation/extensions/"
    xmlns:xs="http://www.w3.org/2001/XMLSchema#"
    xmlns:frbr="http://purl.org/vocab/frbr/core#"
    xmlns:dcterms="http://purl.org/dc/terms/"
    xmlns:pelagios="http://pelagios.github.io/vocab/terms#"
    xmlns:foaf="http://xmlns.com/foaf/0.1/"
    xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
    xmlns:prov="http://www.w3.org/ns/prov#"
    version="1.0">
    
    <xsl:output method="xml" indent="yes"></xsl:output>
    <xsl:param name="e_targets"/>
    <xsl:param name="e_bodies"/>
    <xsl:param name="e_motivation"/>
    
    <xsl:template match="/">
        <xsl:apply-templates/>
    </xsl:template>
    
    <xsl:template match="oa:Annotation">
        <xsl:variable name="targets">
            <xsl:call-template name="tokenize_list">
                <xsl:with-param name="remainder" select="$e_targets"/>
            </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="bodies">
            <xsl:call-template name="tokenize_list">
                <xsl:with-param name="remainder" select="$e_bodies"/>
            </xsl:call-template>
        </xsl:variable>
        <xsl:copy>
            <!-- copy everything we don't edit -->
            <xsl:apply-templates select="@*"/>
            <xsl:apply-templates select="node()"/>
            
            <!-- and rebuild -->
            <xsl:for-each select="tokenize()"></xsl:for-each>
            <xsl:element name="motivatedBy" namespace="http://www.w3.org/ns/oa#">
                <xsl:attribute name="rdf:resource"><xsl:value-of select="$e_motivation"/></xsl:attribute>
            </xsl:element>
            
            
        </xsl:copy>
    </xsl:template>
    
    <xsl:template match="oa:hasTarget"/>
    <xsl:template match="oa:hasBody"/>
    <xsl:template match="oa:serializedBy"/>
    <xsl:template match="oa:annotatedAt"/>
    <xsl:template match="oa:motivatedBy"/>
    
    
    <xsl:template name="tokenize_list">
        <xsl:param name="delim" select="' '"/>
        <xsl:param name="remainder"/>
        <xsl:choose>
            <xsl:when test="contains($remainder,$delim)">
                <xsl:value-of select="substring-before($remainder,$delim)"/>
                <xsl:call-template name="tokenize_list">
                    <xsl:with-param name="delim" select="$delim"/>
                    <xsl:with-param name="remainder" select="substring-after($remainder,$delim)"></xsl:with-param>
                </xsl:call-template>
            </xsl:when>
            <xsl:otherwise>
                <xsl:value-of select="$remainder"/>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>
        
    
        
    

    
    <xsl:template match="/">
        <rdf:RDF>
        <xsl:variable name="doc_uri" select="//rdf:Description[rdf:type[@rdf:resource='http://pelagios.github.io/vocab/terms#AnnotatedThing']]/dcterms:title"/>
        <xsl:for-each select="//rdf:Description[rdf:type[@rdf:resource='http://www.w3.org/ns/openannotation/core/Annotation']]">
            <xsl:variable name="annot_id" select="@rdf:about"/>
            <xsl:variable name="target_node_id" select="//rdf:Description[@rdf:about=$annot_id]/oa:hasTarget/@rdf:nodeID"/>
            
            <xsl:variable name="serialized_by" select="//rdf:Description[@rdf:about=$annot_id]/oa:serializedBy/@rdf:resource"/>
            <xsl:variable name="body_node_id" select="//rdf:Description[@rdf:about=$annot_id]/oa:hasBody/@rdf:nodeID"/>
            <xsl:variable name="body_resource" select="//rdf:Description[@rdf:nodeID=$body_node_id]/rdf:type/@rdf:resource"/>
            <xsl:variable name="target_selector" select="//rdf:Description[@rdf:nodeID=$target_node_id]/oa:hasSelector/@rdf:nodeID"/>
            <xsl:variable name="target_offset" select="//rdf:Description[@rdf:nodeID=$target_selector]/oax:offset"/>
            <xsl:variable name="target_range" select="//rdf:Description[@rdf:nodeID=$target_selector]/oax:range"/>
            <xsl:variable name="target_uri" select="concat($doc_uri,'@','oac:offset',$target_offset,'-oac:range',$target_range)"/>
            <xsl:element name="oac:Annotation">
                <xsl:attribute name="rdf:about"><xsl:value-of select="$annot_id"/></xsl:attribute>
                <xsl:element name="oac:hasTarget">
                    <xsl:attribute name="rdf:resource"><xsl:value-of select="$target_uri"/></xsl:attribute>
                </xsl:element>
                <xsl:element name="oac:hasBody">
                    <xsl:attribute name="rdf:resource"><xsl:value-of select="$body_resource"/></xsl:attribute>
                </xsl:element>
                <xsl:element name="oac:serializedBy">
                    <xsl:element name="prov:SoftwareAgent">
                        <xsl:attribute name="rdf:about"><xsl:value-of select="$serialized_by"/></xsl:attribute>
                    </xsl:element>
                </xsl:element>
                <xsl:element name="oac:motivatedBy">
                    <xsl:attribute name="rdf:resource">oa:identifying</xsl:attribute>
                </xsl:element>
            </xsl:element>
        </xsl:for-each>
        </rdf:RDF>
    </xsl:template>
    
    
</xsl:stylesheet>