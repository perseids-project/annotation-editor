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
    xmlns:exsl="http://exslt.org/common"
    version="1.0">
    
    <xsl:output method="xml" indent="yes"/>
    <xsl:strip-space elements="*"/>
    <xsl:param name="e_targets"/>
    <xsl:param name="e_bodies"/>
    <xsl:param name="e_motivation"/>
    <xsl:param name="e_agentUri"/>
    
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
            <xsl:for-each select="exsl:node-set($targets)/*">
                <xsl:element name="hasTarget" namespace="http://www.w3.org/ns/oa#">
                    <xsl:attribute name="rdf:resource"><xsl:value-of select="."/></xsl:attribute>
                </xsl:element>
            </xsl:for-each>
            <xsl:for-each select="exsl:node-set($bodies)/*">
                <xsl:element name="hasBody" namespace="http://www.w3.org/ns/oa#">
                    <xsl:attribute name="rdf:resource"><xsl:value-of select="."/></xsl:attribute>
                </xsl:element>                
            </xsl:for-each>
            <xsl:element name="motivatedBy" namespace="http://www.w3.org/ns/oa#">
                <xsl:attribute name="rdf:resource"><xsl:value-of select="$e_motivation"/></xsl:attribute>
            </xsl:element>
            <xsl:element name="oa:serializedBy">
                <xsl:element name="prov:SoftwareAgent">
                    <xsl:attribute name="rdf:about"><xsl:value-of select="$e_agentUri"/></xsl:attribute>
                </xsl:element>
            </xsl:element>
        </xsl:copy>
    </xsl:template>
    
    <xsl:template match="oa:hasTarget"/>
    <xsl:template match="oa:hasBody"/>
    <xsl:template match="oa:serializedBy"/>
    <xsl:template match="oa:annotatedAt"/>
    <xsl:template match="oa:motivatedBy"/>
    
    <xsl:template match="@*">
        <xsl:copy/>
    </xsl:template>
    
    <xsl:template match="node()">
        <xsl:copy>
            <xsl:apply-templates select="@*"/>
            <xsl:apply-templates select="node()"/>
        </xsl:copy>
    </xsl:template>
    
    <xsl:template name="tokenize_list">
        <xsl:param name="delim" select="' '"/>
        <xsl:param name="remainder"/>
        <xsl:choose>
            <xsl:when test="contains($remainder,$delim)">
                <item>
                    <xsl:value-of select="substring-before($remainder,$delim)"/>
                </item>
                <xsl:call-template name="tokenize_list">
                    <xsl:with-param name="delim" select="$delim"/>
                    <xsl:with-param name="remainder" select="substring-after($remainder,$delim)"></xsl:with-param>
                </xsl:call-template>
            </xsl:when>
            <xsl:otherwise>
                <item><xsl:value-of select="$remainder"/></item>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>
    
</xsl:stylesheet>